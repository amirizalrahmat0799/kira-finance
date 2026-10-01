import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * A tiny change feed for the local database. Every write calls `notifyChange()`;
 * screens read through `useQuery`, which re-runs its query whenever the data version moves.
 * The sync engine subscribes too, to push local edits shortly after they happen.
 */
type Source = 'local' | 'sync';
type Listener = (source: Source) => void;

let version = 0;
const listeners = new Set<Listener>();

export function notifyChange(source: Source = 'local'): void {
  version++;
  listeners.forEach((l) => l(source));
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function subscribeVersion(onChange: () => void) {
  return subscribe(onChange);
}

export function useDataVersion(): number {
  return useSyncExternalStore(subscribeVersion, () => version, () => version);
}

export function useQuery<T>(
  query: (db: SQLiteDatabase) => Promise<T>,
  deps: readonly unknown[],
): { data: T | undefined; error: Error | null } {
  const db = useSQLiteContext();
  const dataVersion = useDataVersion();
  const [state, setState] = useState<{ data: T | undefined; error: Error | null }>({ data: undefined, error: null });

  useEffect(() => {
    let cancelled = false;
    query(db).then(
      (data) => !cancelled && setState({ data, error: null }),
      (error: unknown) => !cancelled && setState((s) => ({ data: s.data, error: error as Error })),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, dataVersion, ...deps]);

  return state;
}
