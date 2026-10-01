export interface SpendInput {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  total: number;
}

export interface BreakdownRow extends SpendInput {
  /** share of this month's spending, 0..1 */
  share: number;
  /** change vs the previous month as a ratio (0.25 = +25%), null when there was no spending last month */
  change: number | null;
}

/** Shares and month-over-month change per category; small categories beyond `maxRows` are folded into "Other". */
export function categoryBreakdown(current: SpendInput[], previous: SpendInput[], maxRows = 6): BreakdownRow[] {
  const total = current.reduce((s, c) => s + c.total, 0);
  if (total === 0) return [];
  const prev = new Map(previous.map((p) => [p.categoryId, p.total]));

  const sorted = [...current].sort((a, b) => b.total - a.total);
  const head = sorted.slice(0, maxRows);
  const tail = sorted.slice(maxRows);

  const rows: BreakdownRow[] = head.map((c) => {
    const before = prev.get(c.categoryId) ?? 0;
    return { ...c, share: c.total / total, change: before > 0 ? (c.total - before) / before : null };
  });

  if (tail.length > 0) {
    const rest = tail.reduce((s, c) => s + c.total, 0);
    const restBefore = tail.reduce((s, c) => s + (prev.get(c.categoryId) ?? 0), 0);
    rows.push({
      categoryId: '__other__',
      name: `${tail.length} more categories`,
      icon: '⋯',
      color: '#94A3B8',
      total: rest,
      share: rest / total,
      change: restBefore > 0 ? (rest - restBefore) / restBefore : null,
    });
  }
  return rows;
}

/** (income - expense) / income; null when there was no income. */
export function savingsRate(income: number, expense: number): number | null {
  if (income <= 0) return null;
  return (income - expense) / income;
}
