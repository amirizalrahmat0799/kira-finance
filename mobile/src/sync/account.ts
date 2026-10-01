import type { SQLiteDatabase } from 'expo-sqlite';

import { notifyChange } from '@/db/store';
import { TABLES } from '@/db/types';

import { resetSyncState } from './sync';

/**
 * Prepares local data before the first sync with an account.
 *
 * - New account: push everything on this device.
 * - Existing account, and this device has no transactions yet: drop the starter data (default categories and
 *   the Cash account were never synced) so the account's own data comes down without duplicates.
 * - Existing account, and this device already has transactions: merge both sides.
 */
export async function prepareForAccount(db: SQLiteDatabase, mode: 'register' | 'login'): Promise<void> {
  if (mode === 'login') {
    const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM transactions WHERE deleted = 0');
    if (Number(row?.n ?? 0) === 0) {
      await db.withTransactionAsync(async () => {
        for (const table of TABLES) await db.runAsync(`DELETE FROM ${table}`);
      });
      await resetSyncState(db, false);
      notifyChange('sync');
      return;
    }
  }
  await resetSyncState(db, true);
}
