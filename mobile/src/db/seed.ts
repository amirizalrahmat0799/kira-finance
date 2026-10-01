import type { SQLiteDatabase } from 'expo-sqlite';

import { newId } from './id';
import { toParams, upsertSql } from './tables';
import type { Account, Category, Kind } from './types';

export const DEFAULT_CATEGORIES: { name: string; kind: Kind; icon: string; color: string }[] = [
  { name: 'Food & drinks', kind: 'expense', icon: '🍜', color: '#F97316' },
  { name: 'Groceries', kind: 'expense', icon: '🛒', color: '#84CC16' },
  { name: 'Transport', kind: 'expense', icon: '🚗', color: '#3B82F6' },
  { name: 'Bills & utilities', kind: 'expense', icon: '💡', color: '#EAB308' },
  { name: 'Housing', kind: 'expense', icon: '🏠', color: '#8B5CF6' },
  { name: 'Shopping', kind: 'expense', icon: '🛍️', color: '#EC4899' },
  { name: 'Health', kind: 'expense', icon: '💊', color: '#14B8A6' },
  { name: 'Entertainment', kind: 'expense', icon: '🎬', color: '#F43F5E' },
  { name: 'Subscriptions', kind: 'expense', icon: '📺', color: '#6366F1' },
  { name: 'Education', kind: 'expense', icon: '🎓', color: '#0EA5E9' },
  { name: 'Family', kind: 'expense', icon: '👨‍👩‍👧', color: '#A855F7' },
  { name: 'Other', kind: 'expense', icon: '📦', color: '#64748B' },
  { name: 'Salary', kind: 'income', icon: '💼', color: '#22C55E' },
  { name: 'Side income', kind: 'income', icon: '💻', color: '#10B981' },
  { name: 'Gifts', kind: 'income', icon: '🎁', color: '#F59E0B' },
  { name: 'Other income', kind: 'income', icon: '💰', color: '#06B6D4' },
];

/** Gives a brand-new install a cash account and a starter set of categories. */
export async function seedDefaults(db: SQLiteDatabase): Promise<void> {
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    const cash: Account = {
      id: newId(),
      name: 'Cash',
      type: 'cash',
      openingBalance: 0,
      archived: false,
      updatedAt: now,
      deleted: false,
    };
    await db.runAsync(upsertSql('accounts'), { ...toParams('accounts', cash), $dirty: 1 });

    for (const c of DEFAULT_CATEGORIES) {
      const category: Category = { id: newId(), ...c, updatedAt: now, deleted: false };
      await db.runAsync(upsertSql('categories'), { ...toParams('categories', category), $dirty: 1 });
    }
  });
}
