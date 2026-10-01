import type { ISODate } from '@/lib/dates';
import type { Frequency } from '@/lib/recurrence';

export type Kind = 'expense' | 'income';
export type AccountType = 'cash' | 'bank' | 'ewallet' | 'card';

/** Fields every synced row carries. `updatedAt` is the client clock (ms) at the last edit and decides conflicts. */
export interface SyncFields {
  id: string;
  updatedAt: number;
  deleted: boolean;
}

export interface Account extends SyncFields {
  name: string;
  type: AccountType;
  openingBalance: number;
  archived: boolean;
}

export interface Category extends SyncFields {
  name: string;
  kind: Kind;
  color: string;
  icon: string;
}

export interface Transaction extends SyncFields {
  accountId: string;
  categoryId: string;
  kind: Kind;
  amount: number;
  note: string;
  occurredOn: ISODate;
  recurringId: string | null;
}

export interface Budget extends SyncFields {
  categoryId: string;
  amount: number;
}

export interface Recurring extends SyncFields {
  name: string;
  accountId: string;
  categoryId: string;
  kind: Kind;
  amount: number;
  frequency: Frequency;
  startDate: ISODate;
  remindDaysBefore: number;
  active: boolean;
}

export interface EntityMap {
  accounts: Account;
  categories: Category;
  transactions: Transaction;
  budgets: Budget;
  recurring: Recurring;
}

export type TableName = keyof EntityMap;
export const TABLES: TableName[] = ['accounts', 'categories', 'transactions', 'budgets', 'recurring'];

export const ACCOUNT_TYPES: { value: AccountType; label: string; icon: string }[] = [
  { value: 'cash', label: 'Cash', icon: '💵' },
  { value: 'bank', label: 'Bank', icon: '🏦' },
  { value: 'ewallet', label: 'E-wallet', icon: '📱' },
  { value: 'card', label: 'Credit card', icon: '💳' },
];
