import { budgetLevel, crossedThreshold, dailyAllowance } from '@/lib/budget';
import { categoryBreakdown, savingsRate } from '@/lib/insights';

describe('budget levels', () => {
  it('is ok under 80%, a warning from 80%, and over past 100%', () => {
    expect(budgetLevel(79_99, 100_00)).toBe('ok');
    expect(budgetLevel(80_00, 100_00)).toBe('warning');
    expect(budgetLevel(100_00, 100_00)).toBe('warning');
    expect(budgetLevel(100_01, 100_00)).toBe('over');
  });

  it('alerts only when an expense crosses a threshold', () => {
    expect(crossedThreshold(70_00, 85_00, 100_00)).toBe('warning');
    expect(crossedThreshold(85_00, 90_00, 100_00)).toBeNull(); // already warned
    expect(crossedThreshold(90_00, 120_00, 100_00)).toBe('over');
    expect(crossedThreshold(10_00, 150_00, 100_00)).toBe('over'); // jumps straight past both
    expect(crossedThreshold(120_00, 130_00, 100_00)).toBeNull(); // already over
    expect(crossedThreshold(10_00, 20_00, 0)).toBeNull(); // no budget
  });

  it('spreads the remaining budget over the days left', () => {
    expect(dailyAllowance(40_00, 100_00, 6)).toBe(10_00);
    expect(dailyAllowance(120_00, 100_00, 6)).toBe(0);
  });
});

describe('insights', () => {
  const spend = (id: string, total: number) => ({ categoryId: id, name: id, icon: '', color: '#000', total });

  it('computes shares and month-over-month change', () => {
    const rows = categoryBreakdown([spend('food', 300), spend('fun', 100)], [spend('food', 200)]);
    expect(rows.map((r) => [r.categoryId, r.share, r.change])).toEqual([
      ['food', 0.75, 0.5],
      ['fun', 0.25, null],
    ]);
  });

  it('folds small categories into one row', () => {
    const rows = categoryBreakdown([spend('a', 50), spend('b', 30), spend('c', 15), spend('d', 5)], [], 2);
    expect(rows).toHaveLength(3);
    expect(rows[2]).toMatchObject({ categoryId: '__other__', total: 20, name: '2 more categories' });
  });

  it('computes the savings rate', () => {
    expect(savingsRate(5000, 4000)).toBeCloseTo(0.2);
    expect(savingsRate(0, 100)).toBeNull();
  });
});
