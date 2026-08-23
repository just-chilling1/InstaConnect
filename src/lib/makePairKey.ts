/** Creates a stable, order-independent key for a pair of user IDs. */
export function makePairKey(a: string, b: string) {
  return [a, b].sort().join("_");
}
