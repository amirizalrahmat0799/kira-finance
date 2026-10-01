import { addDays, daysInMonth, ISODate, parseISODate, toISODate } from './dates';

export type Frequency = 'weekly' | 'monthly' | 'yearly';

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  weekly: 'Every week',
  monthly: 'Every month',
  yearly: 'Every year',
};

/**
 * The n-th occurrence (0-based) of a schedule that starts on `start`.
 * Monthly and yearly schedules keep the start's day of month and clamp it to shorter months,
 * so a bill on the 31st falls on 28/29 Feb and goes back to the 31st in March.
 */
export function nthOccurrence(start: ISODate, frequency: Frequency, n: number): ISODate {
  if (frequency === 'weekly') return addDays(start, 7 * n);

  const s = parseISODate(start);
  const stepMonths = frequency === 'monthly' ? n : 12 * n;
  const total = s.getFullYear() * 12 + s.getMonth() + stepMonths;
  const year = Math.floor(total / 12);
  const month0 = total % 12;
  const day = Math.min(s.getDate(), daysInMonth(year, month0 + 1));
  return toISODate(new Date(year, month0, day));
}

/** All occurrence dates in [start, until], oldest first. Capped to keep a bad start date from looping forever. */
export function occurrencesUntil(start: ISODate, frequency: Frequency, until: ISODate, max = 500): ISODate[] {
  const out: ISODate[] = [];
  for (let n = 0; n < max; n++) {
    const d = nthOccurrence(start, frequency, n);
    if (d > until) break;
    out.push(d);
  }
  return out;
}

/** First occurrence on or after `from`. */
export function nextOccurrence(start: ISODate, frequency: Frequency, from: ISODate): ISODate {
  if (start >= from) return start;
  for (let n = 1; n < 10_000; n++) {
    const d = nthOccurrence(start, frequency, n);
    if (d >= from) return d;
  }
  return start;
}

/** How much a schedule costs per month on average, for the "bills per month" total. */
export function monthlyEquivalent(amount: number, frequency: Frequency): number {
  if (frequency === 'weekly') return Math.round((amount * 52) / 12);
  if (frequency === 'yearly') return Math.round(amount / 12);
  return amount;
}
