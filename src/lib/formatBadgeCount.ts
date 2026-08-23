/** Formats a badge count for nav display (caps at 99+). */
export function formatBadgeCount(count: number): string | null {
  if (count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}
