import { monthlyEquivalent, nextOccurrence, nthOccurrence, occurrencesUntil } from '@/lib/recurrence';

describe('recurrence', () => {
  it('keeps the day of month and clamps to short months', () => {
    expect(occurrencesUntil('2026-01-31', 'monthly', '2026-05-31')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ]);
  });

  it('handles leap days in yearly schedules', () => {
    expect(nthOccurrence('2028-02-29', 'yearly', 1)).toBe('2029-02-28');
    expect(nthOccurrence('2028-02-29', 'yearly', 4)).toBe('2032-02-29');
  });

  it('steps weekly', () => {
    expect(occurrencesUntil('2026-10-01', 'weekly', '2026-10-20')).toEqual(['2026-10-01', '2026-10-08', '2026-10-15']);
  });

  it('finds the next due date on or after a day', () => {
    expect(nextOccurrence('2026-01-15', 'monthly', '2026-10-02')).toBe('2026-10-15');
    expect(nextOccurrence('2026-01-15', 'monthly', '2026-10-15')).toBe('2026-10-15');
    expect(nextOccurrence('2026-12-01', 'monthly', '2026-10-02')).toBe('2026-12-01');
  });

  it('returns nothing before the start date', () => {
    expect(occurrencesUntil('2026-11-01', 'monthly', '2026-10-31')).toEqual([]);
  });

  it('converts to a monthly cost', () => {
    expect(monthlyEquivalent(1200, 'yearly')).toBe(100);
    expect(monthlyEquivalent(1200, 'weekly')).toBe(5200);
    expect(monthlyEquivalent(1200, 'monthly')).toBe(1200);
  });
});
