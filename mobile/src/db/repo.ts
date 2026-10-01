import type { SQLiteDatabase } from 'expo-sqlite';

import { addMonths, monthRange, type ISODate, type Month } from '@/lib/dates';

import { newId } from './id';
import { notifyChange } from './store';
import { fromRow, toParams, upsertSql, type SqlRow } from './tables';
import type { Account, Budget, Category, EntityMap, Kind, Recurring, TableName, Transaction } from './types';

// ---------------------------------------------------------------------------------------------
// Generic writes: every edit stamps updated_at with the device clock and marks the row dirty.
// ---------------------------------------------------------------------------------------------

export async function save<T extends TableName>(
  db: SQLiteDatabase,
  table: T,
  entity: Omit<EntityMap[T], 'id' | 'updatedAt' | 'deleted'> & { id?: string },
): Promise<EntityMap[T]> {
  const row = { ...entity, id: entity.id ?? newId(), updatedAt: Date.now(), deleted: false } as unknown as EntityMap[T];
  await db.runAsync(upsertSql(table), { ...toParams(table, row), $dirty: 1 });
  notifyChange();
  return row;
}

/** Deletes become tombstones so the deletion reaches the server and the user's other devices. */
export async function softDelete(db: SQLiteDatabase, table: TableName, id: string): Promise<void> {
  await db.runAsync(`UPDATE ${table} SET deleted = 1, dirty = 1, updated_at = $now WHERE id = $id`, {
    $now: Date.now(),
    $id: id,
  });
  notifyChange();
}

async function all<T extends TableName>(db: SQLiteDatabase, table: T, where = '', params: Record<string, string | number> = {}) {
  const rows = await db.getAllAsync<SqlRow>(`SELECT * FROM ${table} WHERE deleted = 0 ${where}`, params);
  return rows.map((r) => fromRow(table, r));
}

// ---------------------------------------------------------------------------------------------
// Accounts & categories
// ---------------------------------------------------------------------------------------------

export function listAccounts(db: SQLiteDatabase, includeArchived = false): Promise<Account[]> {
  return all(db, 'accounts', `${includeArchived ? '' : 'AND archived = 0'} ORDER BY name COLLATE NOCASE`);
}

export interface AccountBalance extends Account {
  balance: number;
}

export async function accountBalances(db: SQLiteDatabase): Promise<AccountBalance[]> {
  const accounts = await listAccounts(db);
  const sums = await db.getAllAsync<{ account_id: string; net: number }>(
    `SELECT account_id, SUM(CASE WHEN kind = 'income' THEN amount ELSE -amount END) AS net
       FROM transactions WHERE deleted = 0 GROUP BY account_id`,
  );
  const net = new Map(sums.map((s) => [s.account_id, Number(s.net)]));
  return accounts.map((a) => ({ ...a, balance: a.openingBalance + (net.get(a.id) ?? 0) }));
}

export function listCategories(db: SQLiteDatabase, kind?: Kind): Promise<Category[]> {
  return kind
    ? all(db, 'categories', 'AND kind = $kind ORDER BY name COLLATE NOCASE', { $kind: kind })
    : all(db, 'categories', 'ORDER BY kind DESC, name COLLATE NOCASE');
}

// ---------------------------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------------------------

export interface TransactionView extends Transaction {
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  accountName: string;
}

const VIEW_SQL = `
  SELECT t.*, COALESCE(c.name, 'Uncategorised') AS category_name, COALESCE(c.icon, '❔') AS category_icon,
         COALESCE(c.color, '#94A3B8') AS category_color, COALESCE(a.name, 'Unknown account') AS account_name
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN accounts a ON a.id = t.account_id
   WHERE t.deleted = 0`;

function toView(r: SqlRow): TransactionView {
  return {
    ...fromRow('transactions', r),
    categoryName: String(r.category_name),
    categoryIcon: String(r.category_icon),
    categoryColor: String(r.category_color),
    accountName: String(r.account_name),
  };
}

export async function getTransaction(db: SQLiteDatabase, id: string): Promise<Transaction | null> {
  const row = await db.getFirstAsync<SqlRow>('SELECT * FROM transactions WHERE id = $id AND deleted = 0', { $id: id });
  return row ? fromRow('transactions', row) : null;
}

export async function listTransactions(
  db: SQLiteDatabase,
  opts: { month?: Month; kind?: Kind; categoryId?: string; limit?: number } = {},
): Promise<TransactionView[]> {
  const where: string[] = [];
  const params: Record<string, string | number> = {};
  if (opts.month) {
    const { start, end } = monthRange(opts.month);
    where.push('t.occurred_on BETWEEN $start AND $end');
    params.$start = start;
    params.$end = end;
  }
  if (opts.kind) {
    where.push('t.kind = $kind');
    params.$kind = opts.kind;
  }
  if (opts.categoryId) {
    where.push('t.category_id = $cat');
    params.$cat = opts.categoryId;
  }
  const sql = `${VIEW_SQL} ${where.map((w) => `AND ${w}`).join(' ')}
    ORDER BY t.occurred_on DESC, t.updated_at DESC ${opts.limit ? `LIMIT ${Math.floor(opts.limit)}` : ''}`;
  const rows = await db.getAllAsync<SqlRow>(sql, params);
  return rows.map(toView);
}

export interface Totals {
  income: number;
  expense: number;
}

export async function monthTotals(db: SQLiteDatabase, month: Month): Promise<Totals> {
  const { start, end } = monthRange(month);
  const row = await db.getFirstAsync<{ income: number | null; expense: number | null }>(
    `SELECT SUM(CASE WHEN kind = 'income' THEN amount END) AS income,
            SUM(CASE WHEN kind = 'expense' THEN amount END) AS expense
       FROM transactions WHERE deleted = 0 AND occurred_on BETWEEN $start AND $end`,
    { $start: start, $end: end },
  );
  return { income: Number(row?.income ?? 0), expense: Number(row?.expense ?? 0) };
}

export interface CategorySpend {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  total: number;
}

export async function spendingByCategory(db: SQLiteDatabase, month: Month, kind: Kind = 'expense'): Promise<CategorySpend[]> {
  const { start, end } = monthRange(month);
  const rows = await db.getAllAsync<{ category_id: string; name: string | null; icon: string | null; color: string | null; total: number }>(
    `SELECT t.category_id, c.name, c.icon, c.color, SUM(t.amount) AS total
       FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.deleted = 0 AND t.kind = $kind AND t.occurred_on BETWEEN $start AND $end
      GROUP BY t.category_id ORDER BY total DESC`,
    { $kind: kind, $start: start, $end: end },
  );
  return rows.map((r) => ({
    categoryId: r.category_id,
    name: r.name ?? 'Uncategorised',
    icon: r.icon ?? '❔',
    color: r.color ?? '#94A3B8',
    total: Number(r.total),
  }));
}

export async function categorySpent(db: SQLiteDatabase, categoryId: string, month: Month): Promise<number> {
  const { start, end } = monthRange(month);
  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(amount) AS total FROM transactions
      WHERE deleted = 0 AND kind = 'expense' AND category_id = $cat AND occurred_on BETWEEN $start AND $end`,
    { $cat: categoryId, $start: start, $end: end },
  );
  return Number(row?.total ?? 0);
}

export interface MonthPoint extends Totals {
  month: Month;
}

/** Income and expense for the `count` months ending at `last` (oldest first). */
export async function monthlySeries(db: SQLiteDatabase, last: Month, count: number): Promise<MonthPoint[]> {
  const first = addMonths(last, -(count - 1));
  const rows = await db.getAllAsync<{ month: string; income: number | null; expense: number | null }>(
    `SELECT substr(occurred_on, 1, 7) AS month,
            SUM(CASE WHEN kind = 'income' THEN amount END) AS income,
            SUM(CASE WHEN kind = 'expense' THEN amount END) AS expense
       FROM transactions WHERE deleted = 0 AND occurred_on BETWEEN $start AND $end
      GROUP BY month`,
    { $start: monthRange(first).start, $end: monthRange(last).end },
  );
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  return Array.from({ length: count }, (_, i) => {
    const month = addMonths(first, i);
    const r = byMonth.get(month);
    return { month, income: Number(r?.income ?? 0), expense: Number(r?.expense ?? 0) };
  });
}

// ---------------------------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------------------------

export interface BudgetView extends Budget {
  name: string;
  icon: string;
  color: string;
  spent: number;
}

export async function budgetsForMonth(db: SQLiteDatabase, month: Month): Promise<BudgetView[]> {
  const { start, end } = monthRange(month);
  const rows = await db.getAllAsync<SqlRow>(
    `SELECT b.*, c.name AS c_name, c.icon AS c_icon, c.color AS c_color,
            (SELECT COALESCE(SUM(t.amount), 0) FROM transactions t
              WHERE t.deleted = 0 AND t.kind = 'expense' AND t.category_id = b.category_id
                AND t.occurred_on BETWEEN $start AND $end) AS spent
       FROM budgets b JOIN categories c ON c.id = b.category_id AND c.deleted = 0
      WHERE b.deleted = 0
      ORDER BY c.name COLLATE NOCASE`,
    { $start: start, $end: end },
  );
  return rows.map((r) => ({
    ...fromRow('budgets', r),
    name: String(r.c_name),
    icon: String(r.c_icon),
    color: String(r.c_color),
    spent: Number(r.spent),
  }));
}

export async function budgetForCategory(db: SQLiteDatabase, categoryId: string): Promise<Budget | null> {
  const row = await db.getFirstAsync<SqlRow>('SELECT * FROM budgets WHERE category_id = $cat AND deleted = 0', {
    $cat: categoryId,
  });
  return row ? fromRow('budgets', row) : null;
}

// ---------------------------------------------------------------------------------------------
// Recurring bills
// ---------------------------------------------------------------------------------------------

export interface RecurringView extends Recurring {
  categoryIcon: string;
  categoryColor: string;
}

export async function listRecurring(db: SQLiteDatabase): Promise<RecurringView[]> {
  const rows = await db.getAllAsync<SqlRow>(
    `SELECT r.*, COALESCE(c.icon, '🔁') AS c_icon, COALESCE(c.color, '#94A3B8') AS c_color
       FROM recurring r LEFT JOIN categories c ON c.id = r.category_id
      WHERE r.deleted = 0 ORDER BY r.name COLLATE NOCASE`,
  );
  return rows.map((r) => ({ ...fromRow('recurring', r), categoryIcon: String(r.c_icon), categoryColor: String(r.c_color) }));
}

export async function getRecurring(db: SQLiteDatabase, id: string): Promise<Recurring | null> {
  const row = await db.getFirstAsync<SqlRow>('SELECT * FROM recurring WHERE id = $id AND deleted = 0', { $id: id });
  return row ? fromRow('recurring', row) : null;
}

/** True if a transaction with this id exists, including deleted ones (a deleted bill payment must not come back). */
export async function transactionExists(db: SQLiteDatabase, id: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM transactions WHERE id = $id', { $id: id });
  return Number(row?.n ?? 0) > 0;
}

// ---------------------------------------------------------------------------------------------
// Key/value settings
// ---------------------------------------------------------------------------------------------

export async function getMeta(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = $key', { $key: key });
  return row?.value ?? null;
}

export async function setMeta(db: SQLiteDatabase, key: string, value: string | null): Promise<void> {
  if (value === null) await db.runAsync('DELETE FROM meta WHERE key = $key', { $key: key });
  else await db.runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES ($key, $value)', { $key: key, $value: value });
}

export type { ISODate };
