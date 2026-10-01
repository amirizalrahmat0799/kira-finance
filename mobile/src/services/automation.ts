import type { SQLiteDatabase } from 'expo-sqlite';

import { recurringTransactionId } from '@/db/id';
import { budgetForCategory, categorySpent, listRecurring, transactionExists } from '@/db/repo';
import { notifyChange } from '@/db/store';
import { toParams, upsertSql } from '@/db/tables';
import type { Transaction } from '@/db/types';
import { crossedThreshold } from '@/lib/budget';
import { addDays, monthOf, today, type ISODate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { nextOccurrence, occurrencesUntil } from '@/lib/recurrence';

import { notifyNow, scheduleBillReminders } from './notifications';

/** Bills older than this aren't back-filled when a rule is created with an old start date. */
const BACKFILL_DAYS = 62;

/**
 * Posts a transaction for every recurring bill that has come due and hasn't been posted yet.
 * Ids are derived from (rule, due date), so this is safe to run any number of times, on any device.
 */
export async function postDueRecurring(
  db: SQLiteDatabase,
  now: ISODate = today(),
  backfillDays: number = BACKFILL_DAYS,
): Promise<number> {
  const rules = (await listRecurring(db)).filter((r) => r.active);
  const earliest = addDays(now, -backfillDays);
  let posted = 0;

  for (const rule of rules) {
    for (const due of occurrencesUntil(rule.startDate, rule.frequency, now)) {
      if (due < earliest) continue;
      const id = await recurringTransactionId(rule.id, due);
      if (await transactionExists(db, id)) continue;

      const tx: Transaction = {
        id,
        accountId: rule.accountId,
        categoryId: rule.categoryId,
        kind: rule.kind,
        amount: rule.amount,
        note: rule.name,
        occurredOn: due,
        recurringId: rule.id,
        updatedAt: Date.now(),
        deleted: false,
      };
      await db.runAsync(upsertSql('transactions'), { ...toParams('transactions', tx), $dirty: 1 });
      posted++;
    }
  }
  if (posted > 0) notifyChange();
  return posted;
}

/** Schedules a reminder for the next due date of every active bill. */
export async function refreshBillReminders(db: SQLiteDatabase, now: ISODate = today()): Promise<number> {
  const rules = (await listRecurring(db)).filter((r) => r.active && r.kind === 'expense');
  return scheduleBillReminders(
    rules.map((r) => ({
      name: r.name,
      amountLabel: formatMoney(r.amount),
      dueDate: nextOccurrence(r.startDate, r.frequency, addDays(now, 1)),
      remindDaysBefore: r.remindDaysBefore,
    })),
  );
}

export interface BudgetAlert {
  level: 'warning' | 'over';
  title: string;
  body: string;
}

/**
 * Call after saving an expense with the category's spending *before* the save.
 * Returns an alert when the expense crossed 80% or 100% of the category's monthly budget.
 */
export async function checkBudgetAlert(
  db: SQLiteDatabase,
  categoryId: string,
  categoryName: string,
  date: ISODate,
  spentBefore: number,
): Promise<BudgetAlert | null> {
  const budget = await budgetForCategory(db, categoryId);
  if (!budget) return null;
  const spentAfter = await categorySpent(db, categoryId, monthOf(date));
  const level = crossedThreshold(spentBefore, spentAfter, budget.amount);
  if (!level) return null;

  const alert: BudgetAlert =
    level === 'over'
      ? {
          level,
          title: `Over budget: ${categoryName}`,
          body: `You've spent ${formatMoney(spentAfter)} of your ${formatMoney(budget.amount)} budget this month.`,
        }
      : {
          level,
          title: `80% of ${categoryName} budget used`,
          body: `${formatMoney(Math.max(0, budget.amount - spentAfter))} left for this month.`,
        };
  await notifyNow(alert.title, alert.body);
  return alert;
}
