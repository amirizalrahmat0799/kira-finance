import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { getMeta } from '@/db/repo';
import { subscribe } from '@/db/store';
import { postDueRecurring, refreshBillReminders } from '@/services/automation';

import { ApiError } from './api';
import { loadSession, onSessionChange, type Session } from './session';
import { LAST_SYNC_KEY, syncOnce } from './sync';

export type SyncStatus = 'signed-out' | 'idle' | 'syncing' | 'error';

interface SyncState {
  session: Session | null;
  status: SyncStatus;
  lastSyncedAt: number | null;
  error: string | null;
  syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncState | null>(null);

/** Push local edits this long after the last one, so a burst of edits becomes one request. */
const DEBOUNCE_MS = 3000;

/**
 * Runs the offline-first loop: the app always reads and writes SQLite; this provider syncs in the background
 * when the user is signed in (on start, when the app returns to the foreground, after local edits, or on demand).
 * It also posts due recurring bills and refreshes reminders, locally, whether or not the user has an account.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SyncStatus>('signed-out');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const running = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runAutomation = useCallback(async () => {
    try {
      await postDueRecurring(db);
      await refreshBillReminders(db);
    } catch (e) {
      console.warn('automation failed', e);
    }
  }, [db]);

  const syncNow = useCallback(async () => {
    if (!(await loadSession())) return;
    if (running.current) {
      again.current = true; // run once more when the current sync finishes
      return running.current;
    }
    running.current = (async () => {
      do {
        again.current = false;
        setStatus('syncing');
        try {
          const res = await syncOnce(db);
          setLastSyncedAt(res.at);
          setError(null);
          setStatus('idle');
          if (res.pulled > 0) await runAutomation();
        } catch (e) {
          const message = e instanceof ApiError ? e.message : 'Sync failed';
          setError(message);
          setStatus((await loadSession()) ? 'error' : 'signed-out');
          break;
        }
      } while (again.current);
    })().finally(() => {
      running.current = null;
    });
    return running.current;
  }, [db, runAutomation]);

  // Session bootstrap and changes (sign in / out)
  useEffect(() => {
    let active = true;
    (async () => {
      const s = await loadSession();
      const last = await getMeta(db, LAST_SYNC_KEY);
      if (!active) return;
      setSession(s);
      setLastSyncedAt(last ? Number(last) : null);
      setStatus(s ? 'idle' : 'signed-out');
      await runAutomation();
      if (s) void syncNow();
    })();
    const off = onSessionChange((s) => {
      setSession(s);
      setStatus(s ? 'idle' : 'signed-out');
      if (!s) setError(null);
    });
    return () => {
      active = false;
      off();
    };
  }, [db, runAutomation, syncNow]);

  // Debounced push after local edits
  useEffect(
    () =>
      subscribe((source) => {
        if (source !== 'local') return;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void syncNow(), DEBOUNCE_MS);
      }),
    [syncNow],
  );

  // Back in the foreground: post bills that came due and sync
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void runAutomation();
      void syncNow();
    });
    return () => sub.remove();
  }, [runAutomation, syncNow]);

  const value = useMemo(
    () => ({ session, status, lastSyncedAt, error, syncNow }),
    [session, status, lastSyncedAt, error, syncNow],
  );
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncState {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used inside <SyncProvider>');
  return ctx;
}
