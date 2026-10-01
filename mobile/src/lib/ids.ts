/**
 * Formats a SHA-1 hex digest as a version-5 style UUID (RFC 4122 layout).
 *
 * Recurring bills post one transaction per due date. The id of that transaction is derived from
 * "<rule id>:<due date>", so two phones that are both offline on the due day post the *same* row,
 * and the server merges them instead of charging the bill twice.
 */
export function uuidFromSha1Hex(hex: string): string {
  if (!/^[0-9a-f]{40}$/i.test(hex)) throw new Error('expected a SHA-1 hex digest');
  const h = hex.toLowerCase();
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return [h.slice(0, 8), h.slice(8, 12), '5' + h.slice(13, 16), variant + h.slice(17, 20), h.slice(20, 32)].join('-');
}

export function recurringOccurrenceKey(ruleId: string, dueDate: string): string {
  return `kira:recurring:${ruleId}:${dueDate}`;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
