export type BudgetLevel = 'ok' | 'warning' | 'over';

/** Warn at 80% of the budget, alert when it's used up. */
export const WARN_AT = 0.8;

export function budgetLevel(spent: number, limit: number): BudgetLevel {
  if (limit <= 0) return 'ok';
  if (spent > limit) return 'over';
  if (spent >= limit * WARN_AT) return 'warning';
  return 'ok';
}

export function budgetRatio(spent: number, limit: number): number {
  if (limit <= 0) return 0;
  return spent / limit;
}

/**
 * Which alert (if any) a new expense should trigger: only when it *crosses* a threshold,
 * so you get one "80% used" and one "over budget" notification per category per month, not one per expense.
 */
export function crossedThreshold(before: number, after: number, limit: number): 'warning' | 'over' | null {
  if (limit <= 0 || after <= before) return null;
  if (before <= limit && after > limit) return 'over';
  const warnAt = limit * WARN_AT;
  if (before < warnAt && after >= warnAt) return 'warning';
  return null;
}

/** Remaining budget per day for the rest of the month, used for "RM x / day left". */
export function dailyAllowance(spent: number, limit: number, daysLeft: number): number {
  if (daysLeft <= 0) return 0;
  return Math.max(0, Math.floor((limit - spent) / daysLeft));
}
