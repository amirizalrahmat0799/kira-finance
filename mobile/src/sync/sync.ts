import type { SQLiteDatabase } from 'expo-sqlite';

import { getMeta, setMeta } from '@/db/repo';
import { notifyChange } from '@/db/store';
import { fromRow, fromWire, toParams, toWire, upsertSql, type SqlRow } from '@/db/tables';
import { TABLES, type TableName } from '@/db/types';

import { authFetch } from './api';
import { shouldApplyRemote } from './merge';

type Changes = Record<TableName, Record<string, unknown>[]>;

interface SyncResponse {
  cursor: number;
  changes: Partial<Changes>;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  at: number;
}

const CURSOR_KEY = 'sync.cursor';
export const LAST_SYNC_KEY = 'sync.lastSyncedAt';

/**
 * One round trip of the sync protocol:
 *  1. push every dirty row (with the server cursor we last saw),
 *  2. the server applies them (last write wins) and returns every row that changed after our cursor,
 *  3. apply those locally, clear the dirty flags we pushed, and store the new cursor.
 * Edits made while the request is in flight stay dirty, because we only clear rows whose updated_at didn't change.
 */
export async function syncOnce(db: SQLiteDatabase): Promise<SyncResult> {
  const cursor = Number((await getMeta(db, CURSOR_KEY)) ?? 0);

  const changes = {} as Changes;
  const pushedVersions: { table: TableName; id: string; updatedAt: number }[] = [];
  for (const table of TABLES) {
    const rows = await db.getAllAsync<SqlRow>(`SELECT * FROM ${table} WHERE dirty = 1`);
    changes[table] = rows.map((r) => {
      const entity = fromRow(table, r);
      pushedVersions.push({ table, id: entity.id, updatedAt: entity.updatedAt });
      return toWire(table, entity);
    });
  }

  const res = await authFetch<SyncResponse>('/api/v1/sync', {
    method: 'POST',
    body: JSON.stringify({ cursor, changes }),
  });

  let pulled = 0;
  await db.withTransactionAsync(async () => {
    for (const p of pushedVersions) {
      await db.runAsync(`UPDATE ${p.table} SET dirty = 0 WHERE id = $id AND updated_at = $u`, { $id: p.id, $u: p.updatedAt });
    }

    for (const table of TABLES) {
      for (const json of res.changes[table] ?? []) {
        const remote = fromWire(table, json);
        const local = await db.getFirstAsync<{ updated_at: number; dirty: number }>(
          `SELECT updated_at, dirty FROM ${table} WHERE id = $id`,
          { $id: remote.id },
        );
        const localState = local ? { updatedAt: Number(local.updated_at), dirty: local.dirty === 1 } : null;
        if (!shouldApplyRemote(localState, remote)) continue;
        await db.runAsync(upsertSql(table), { ...toParams(table, remote), $dirty: 0 });
        pulled++;
      }
    }

    await setMeta(db, CURSOR_KEY, String(res.cursor));
    await setMeta(db, LAST_SYNC_KEY, String(Date.now()));
  });

  notifyChange('sync');
  return { pushed: pushedVersions.length, pulled, at: Date.now() };
}

/** Forget the server cursor (after signing out or switching account) so the next sync is a full one. */
export async function resetSyncState(db: SQLiteDatabase, markAllDirty: boolean): Promise<void> {
  await setMeta(db, CURSOR_KEY, null);
  await setMeta(db, LAST_SYNC_KEY, null);
  if (markAllDirty) {
    for (const table of TABLES) await db.runAsync(`UPDATE ${table} SET dirty = 1`);
  }
}

export async function pendingChanges(db: SQLiteDatabase): Promise<number> {
  let n = 0;
  for (const table of TABLES) {
    const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} WHERE dirty = 1`);
    n += Number(row?.n ?? 0);
  }
  return n;
}
