import { addDays, addMonths, dayLabel, daysBetween, isValidISODate, monthRange, relativeDays } from '@/lib/dates';

describe('dates', () => {
  it('adds days across month and year ends', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('adds months', () => {
    expect(addMonths('2026-11', 2)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });

  it('knows month lengths, including leap years', () => {
    expect(monthRange('2028-02')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
    expect(monthRange('2026-02').end).toBe('2026-02-28');
  });

  it('validates dates', () => {
    expect(isValidISODate('2026-02-28')).toBe(true);
    expect(isValidISODate('2026-02-30')).toBe(false);
    expect(isValidISODate('26-2-1')).toBe(false);
  });

  it('labels days relative to today', () => {
    expect(daysBetween('2026-10-01', '2026-10-05')).toBe(4);
    expect(dayLabel('2026-10-05', '2026-10-05')).toBe('Today');
    expect(dayLabel('2026-10-04', '2026-10-05')).toBe('Yesterday');
    expect(dayLabel('2026-09-28', '2026-10-05')).toBe('Mon, 28 Sep');
    expect(relativeDays('2026-10-08', '2026-10-05')).toBe('in 3 days');
  });
});
