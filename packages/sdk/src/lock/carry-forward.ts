export function carrySourcelessLockEntry(
  entries: Map<string, string>,
  baseline: ReadonlyMap<string, string>,
  key: string,
): void {
  const prior = baseline.get(key);
  if (prior !== undefined) {
    entries.set(key, prior);
  }
}
