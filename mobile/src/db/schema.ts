import type { SQLiteDatabase } from 'expo-sqlite';

import { seedDefaults } from './seed';

/**
 * Local schema. Every synced table has:
 *  - updated_at: client clock at the last edit (ms), used for last-write-wins
 *  - deleted:    tombstone, so deletions sync like any other change
 *  - dirty:      1 while the row has local changes the server hasn't seen yet
 * There are no foreign keys: rows can arrive from the server in any order.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE accounts (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    opening_balance INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    dirty INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE categories (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    color TEXT NOT NULL,
    icon TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    dirty INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE transactions (
    id TEXT PRIMARY KEY NOT NULL,
    account_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    amount INTEGER NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    occurred_on TEXT NOT NULL,
    recurring_id TEXT,
    updated_at INTEGER NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    dirty INTEGER NOT NULL DEFAULT 1
  );
  CREATE INDEX idx_transactions_date ON transactions (occurred_on);
  CREATE INDEX idx_transactions_category ON transactions (category_id, occurred_on);
  CREATE TABLE budgets (
    id TEXT PRIMARY KEY NOT NULL,
    category_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    dirty INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE recurring (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    account_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    amount INTEGER NOT NULL,
    frequency TEXT NOT NULL,
    start_date TEXT NOT NULL,
    remind_days_before INTEGER NOT NULL DEFAULT 2,
    active INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL,
    deleted INTEGER NOT NULL DEFAULT 0,
    dirty INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];

/** Runs pending migrations (tracked with PRAGMA user_version) and seeds a fresh database. */
export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current >= MIGRATIONS.length) return;

  for (let v = current; v < MIGRATIONS.length; v++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[v]);
      await db.execAsync(`PRAGMA user_version = ${v + 1}`);
    });
  }
  if (current === 0) await seedDefaults(db);
}
