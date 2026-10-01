import type { EntityMap, TableName } from './types';

type ColumnType = 'text' | 'int' | 'bool' | 'nullable-text';

interface Column {
  /** SQLite column name */
  col: string;
  /** Property name in TypeScript and in the sync JSON (matches the Java records on the server) */
  key: string;
  type: ColumnType;
}

/**
 * One description of every synced table, used both to read/write SQLite and to build the sync payload,
 * so the column list can't drift between the two.
 */
const BASE: Column[] = [
  { col: 'id', key: 'id', type: 'text' },
  { col: 'updated_at', key: 'updatedAt', type: 'int' },
  { col: 'deleted', key: 'deleted', type: 'bool' },
];

export const COLUMNS: Record<TableName, Column[]> = {
  accounts: [
    ...BASE,
    { col: 'name', key: 'name', type: 'text' },
    { col: 'type', key: 'type', type: 'text' },
    { col: 'opening_balance', key: 'openingBalance', type: 'int' },
    { col: 'archived', key: 'archived', type: 'bool' },
  ],
  categories: [
    ...BASE,
    { col: 'name', key: 'name', type: 'text' },
    { col: 'kind', key: 'kind', type: 'text' },
    { col: 'color', key: 'color', type: 'text' },
    { col: 'icon', key: 'icon', type: 'text' },
  ],
  transactions: [
    ...BASE,
    { col: 'account_id', key: 'accountId', type: 'text' },
    { col: 'category_id', key: 'categoryId', type: 'text' },
    { col: 'kind', key: 'kind', type: 'text' },
    { col: 'amount', key: 'amount', type: 'int' },
    { col: 'note', key: 'note', type: 'text' },
    { col: 'occurred_on', key: 'occurredOn', type: 'text' },
    { col: 'recurring_id', key: 'recurringId', type: 'nullable-text' },
  ],
  budgets: [
    ...BASE,
    { col: 'category_id', key: 'categoryId', type: 'text' },
    { col: 'amount', key: 'amount', type: 'int' },
  ],
  recurring: [
    ...BASE,
    { col: 'name', key: 'name', type: 'text' },
    { col: 'account_id', key: 'accountId', type: 'text' },
    { col: 'category_id', key: 'categoryId', type: 'text' },
    { col: 'kind', key: 'kind', type: 'text' },
    { col: 'amount', key: 'amount', type: 'int' },
    { col: 'frequency', key: 'frequency', type: 'text' },
    { col: 'start_date', key: 'startDate', type: 'text' },
    { col: 'remind_days_before', key: 'remindDaysBefore', type: 'int' },
    { col: 'active', key: 'active', type: 'bool' },
  ],
};

export type SqlRow = Record<string, string | number | null>;
type SqlValue = string | number | null;

/** SQLite row -> entity */
export function fromRow<T extends TableName>(table: T, row: SqlRow): EntityMap[T] {
  const out: Record<string, unknown> = {};
  for (const c of COLUMNS[table]) {
    const v = row[c.col];
    if (c.type === 'bool') out[c.key] = v === 1 || v === '1';
    else if (c.type === 'int') out[c.key] = Number(v ?? 0);
    else if (c.type === 'nullable-text') out[c.key] = v ?? null;
    else out[c.key] = v ?? '';
  }
  return out as unknown as EntityMap[T];
}

/** entity -> named SQL parameters ($col) */
export function toParams<T extends TableName>(table: T, entity: EntityMap[T]): Record<string, SqlValue> {
  const params: Record<string, SqlValue> = {};
  const e = entity as unknown as Record<string, unknown>;
  for (const c of COLUMNS[table]) {
    const v = e[c.key];
    params[`$${c.col}`] = c.type === 'bool' ? (v ? 1 : 0) : ((v ?? null) as SqlValue);
  }
  return params;
}

/** INSERT OR REPLACE statement for a table, with a `dirty` flag appended. */
export function upsertSql(table: TableName): string {
  const cols = COLUMNS[table].map((c) => c.col);
  return `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}, dirty) VALUES (${cols.map((c) => '$' + c).join(', ')}, $dirty)`;
}

/** Wire format of a row (what the server receives and returns): the entity itself, with `deleted` included. */
export function toWire<T extends TableName>(table: T, entity: EntityMap[T]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const e = entity as unknown as Record<string, unknown>;
  for (const c of COLUMNS[table]) out[c.key] = e[c.key] ?? (c.type === 'nullable-text' ? null : undefined);
  return out;
}

/** Server JSON -> entity, tolerating missing optional fields. */
export function fromWire<T extends TableName>(table: T, json: Record<string, unknown>): EntityMap[T] {
  const out: Record<string, unknown> = {};
  for (const c of COLUMNS[table]) {
    const v = json[c.key];
    if (c.type === 'bool') out[c.key] = Boolean(v);
    else if (c.type === 'int') out[c.key] = Number(v ?? 0);
    else if (c.type === 'nullable-text') out[c.key] = v == null ? null : String(v);
    else out[c.key] = v == null ? '' : String(v);
  }
  return out as unknown as EntityMap[T];
}
