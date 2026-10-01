/**
 * Calendar dates are plain "YYYY-MM-DD" strings in the user's local time zone, and months are "YYYY-MM".
 * Strings sort correctly, compare with < and >, and avoid time-zone surprises in SQLite and over the wire.
 */

export type ISODate = string; // YYYY-MM-DD
export type Month = string; // YYYY-MM

const pad = (n: number) => n.toString().padStart(2, '0');

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(now: Date = new Date()): ISODate {
  return toISODate(now);
}

/** Parses "YYYY-MM-DD" as a local date (new Date("2026-01-05") would be UTC midnight). */
export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return toISODate(parseISODate(s)) === s;
}

export function addDays(s: ISODate, days: number): ISODate {
  const d = parseISODate(s);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function daysBetween(from: ISODate, to: ISODate): number {
  const ms = parseISODate(to).getTime() - parseISODate(from).getTime();
  return Math.round(ms / 86_400_000);
}

export function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

export function monthOf(s: ISODate): Month {
  return s.slice(0, 7);
}

export function addMonths(m: Month, delta: number): Month {
  const [y, mo] = m.split('-').map(Number);
  const total = y * 12 + (mo - 1) + delta;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

export function monthRange(m: Month): { start: ISODate; end: ISODate } {
  const [y, mo] = m.split('-').map(Number);
  return { start: `${m}-01`, end: `${m}-${pad(daysInMonth(y, mo))}` };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "2026-10" -> "October 2026" style short label: "Oct 2026" */
export function monthLabel(m: Month): string {
  const [y, mo] = m.split('-').map(Number);
  return `${MONTHS[mo - 1]} ${y}`;
}

export function shortMonth(m: Month): string {
  return MONTHS[Number(m.slice(5, 7)) - 1];
}

/** Friendly label for list headers: "Today", "Yesterday", "Mon, 28 Sep". */
export function dayLabel(s: ISODate, now: ISODate = today()): string {
  const diff = daysBetween(s, now);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff === -1) return 'Tomorrow';
  const d = parseISODate(s);
  const base = `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return s.slice(0, 4) === now.slice(0, 4) ? base : `${base} ${d.getFullYear()}`;
}

/** "in 3 days", "today", "2 days ago" */
export function relativeDays(s: ISODate, now: ISODate = today()): string {
  const diff = daysBetween(now, s);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  return diff > 0 ? `in ${diff} days` : `${-diff} days ago`;
}
