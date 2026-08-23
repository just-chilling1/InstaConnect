/** Short relative time, e.g. "2h", "3d", "5mo" — camera-readout style. */
export function timeAgo(timestamp: number): string {
  const diffSeconds = Math.max(0, (Date.now() - timestamp) / 1000);
  const units: [number, string][] = [
    [60, "s"],
    [60, "m"],
    [24, "h"],
    [7, "d"],
    [4.345, "w"],
    [12, "mo"],
    [Infinity, "y"],
  ];
  let value = diffSeconds;
  for (const [size, label] of units) {
    if (value < size) {
      return `${Math.max(1, Math.floor(value))}${label}`;
    }
    value /= size;
  }
  return "now";
}
