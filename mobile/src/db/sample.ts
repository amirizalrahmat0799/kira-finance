import type { SQLiteDatabase } from 'expo-sqlite';

import { addDays, addMonths, monthOf, today, type ISODate } from '@/lib/dates';
import { postDueRecurring } from '@/services/automation';

import { listAccounts, listCategories } from './repo';
import { newId } from './id';
import { notifyChange } from './store';
import { toParams, upsertSql } from './tables';
import type { Account, Budget, Category, Recurring, TableName, Transaction } from './types';

/** Small deterministic PRNG so the sample looks the same every time. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Adds ~3 months of realistic Malaysian spending, a few budgets and recurring bills. */
export async function addSampleData(db: SQLiteDatabase): Promise<void> {
  const rand = rng(42);
  const between = (lo: number, hi: number) => Math.round((lo + rand() * (hi - lo)) * 100);
  const now = Date.now();
  const end = today();
  const start = `${addMonths(monthOf(end), -2)}-01`;

  const categories = await listCategories(db);
  const cat = (name: string): Category | undefined => categories.find((c) => c.name === name);

  const write = async <T extends TableName>(table: T, row: object) =>
    db.runAsync(upsertSql(table), { ...toParams(table, { updatedAt: now, deleted: false, ...row } as never), $dirty: 1 });

  await db.withTransactionAsync(async () => {
    const existing = await listAccounts(db);
    const cash = existing.find((a) => a.type === 'cash') ?? existing[0];
    if (cash && cash.openingBalance === 0) await write('accounts', { ...cash, openingBalance: 60000 });
    const bank: Account = { id: newId(), name: 'Maybank', type: 'bank', openingBalance: 350000, archived: false, updatedAt: now, deleted: false };
    const wallet: Account = { id: newId(), name: "Touch 'n Go", type: 'ewallet', openingBalance: 150000, archived: false, updatedAt: now, deleted: false };
    await write('accounts', bank);
    await write('accounts', wallet);

    const tx = async (name: string, accountId: string, amount: number, day: ISODate, note: string) => {
      const c = cat(name);
      if (!c) return;
      const row: Transaction = {
        id: newId(),
        accountId,
        categoryId: c.id,
        kind: c.kind,
        amount,
        note,
        occurredOn: day,
        recurringId: null,
        updatedAt: now,
        deleted: false,
      };
      await write('transactions', row);
    };

    const foods = ['Nasi lemak', 'Mamak with team', 'Chicken rice', 'Kopi & roti bakar', 'Grab Food', 'Laksa', 'Dinner out'];
    const rides = ['Grab ride', 'Petrol', 'LRT top-up', 'Parking', 'Toll'];
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const meals = 1 + Math.floor(rand() * 2);
      for (let i = 0; i < meals; i++) {
        const r = rand();
        const from = r < 0.4 ? wallet.id : r < 0.6 ? (cash?.id ?? bank.id) : bank.id;
        await tx('Food & drinks', from, between(7, 28), d, foods[Math.floor(rand() * foods.length)]);
      }
      if (rand() < 0.35) await tx('Transport', rand() < 0.5 ? wallet.id : bank.id, between(8, 55), d, rides[Math.floor(rand() * rides.length)]);
      if (rand() < 0.14) await tx('Groceries', bank.id, between(60, 180), d, rand() < 0.5 ? 'Lotus’s' : 'Jaya Grocer');
      if (rand() < 0.07) await tx('Shopping', bank.id, between(40, 220), d, rand() < 0.5 ? 'Shopee' : 'Uniqlo');
      if (rand() < 0.05) await tx('Entertainment', bank.id, between(25, 90), d, rand() < 0.5 ? 'Cinema' : 'Badminton court');
      if (rand() < 0.03) await tx('Health', bank.id, between(30, 120), d, 'Clinic');
    }

    const budgets: [string, number][] = [
      ['Food & drinks', 70000],
      ['Groceries', 50000],
      ['Transport', 35000],
      ['Shopping', 30000],
      ['Entertainment', 15000],
    ];
    for (const [name, amount] of budgets) {
      const c = cat(name);
      if (!c) continue;
      const b: Budget = { id: newId(), categoryId: c.id, amount, updatedAt: now, deleted: false };
      await write('budgets', b);
    }

    const bills: [string, string, number, number, 'expense' | 'income'][] = [
      ['Rent', 'Housing', 120000, 1, 'expense'],
      ['Unifi fibre', 'Bills & utilities', 13900, 15, 'expense'],
      ['TNB electricity', 'Bills & utilities', 9800, 18, 'expense'],
      ['Netflix', 'Subscriptions', 5500, 20, 'expense'],
      ['Salary', 'Salary', 520000, 25, 'income'],
    ];
    for (const [name, catName, amount, day, kind] of bills) {
      const c = cat(catName);
      if (!c) continue;
      const r: Recurring = {
        id: newId(),
        name,
        accountId: bank.id,
        categoryId: c.id,
        kind,
        amount,
        frequency: 'monthly',
        startDate: `${start.slice(0, 7)}-${String(day).padStart(2, '0')}`,
        remindDaysBefore: 2,
        active: true,
        updatedAt: now,
        deleted: false,
      };
      await write('recurring', r);
    }
  });

  await postDueRecurring(db, end, 120);
  notifyChange();
}
