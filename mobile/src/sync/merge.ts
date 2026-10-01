/**
 * Conflict rule when the server sends a row the device already has.
 *
 * - The device has no copy, or its copy has no unsent edits: take the server's version.
 * - The device has an unsent edit that is newer (by the editing device's clock): keep it; it will be pushed next.
 * - Otherwise the server's version wins (last write wins, ties go to the server).
 */
export function shouldApplyRemote(
  local: { updatedAt: number; dirty: boolean } | null,
  remote: { updatedAt: number },
): boolean {
  if (!local || !local.dirty) return true;
  return remote.updatedAt >= local.updatedAt;
}
