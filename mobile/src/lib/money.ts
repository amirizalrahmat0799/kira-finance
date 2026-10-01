/**
 * Money is stored as integer sen (1/100 of a ringgit) everywhere: in SQLite, in the sync payload and on the server.
 * Floating point is only used at the edges, for display.
 */

export const CURRENCY = 'RM';

/** "12", "12.5", "1,234.56" -> 1250 etc. Returns null for anything that isn't a positive amount with at most 2 decimals. */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[,\s]/g, '').replace(/^RM/i, '');
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole, frac = ''] = cleaned.split('.');
  const sen = Number(whole) * 100 + Number((frac + '00').slice(0, 2));
  if (!Number.isSafeInteger(sen) || sen <= 0) return null;
  return sen;
}

/** 123456 -> "1,234.56" */
export function formatPlain(sen: number): string {
  const negative = sen < 0;
  const abs = Math.abs(Math.round(sen));
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const frac = (abs % 100).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${frac}`;
}

/** 123456 -> "RM 1,234.56", -500 -> "-RM 5.00" */
export function formatMoney(sen: number): string {
  const plain = formatPlain(Math.abs(sen));
  return `${sen < 0 ? '-' : ''}${CURRENCY} ${plain}`;
}

/** Short form for chart labels: 1250000 -> "RM 12.5k" */
export function formatCompact(sen: number): string {
  const ringgit = sen / 100;
  const abs = Math.abs(ringgit);
  if (abs >= 1_000_000) return `${CURRENCY} ${trim(ringgit / 1_000_000)}m`;
  if (abs >= 1_000) return `${CURRENCY} ${trim(ringgit / 1_000)}k`;
  return `${CURRENCY} ${Math.round(ringgit)}`;
}

function trim(n: number): string {
  return n.toFixed(1).replace(/\.0$/, '');
}

/** Value to pre-fill an amount input when editing: 1250 -> "12.50" */
export function toInput(sen: number): string {
  return (sen / 100).toFixed(2);
}
