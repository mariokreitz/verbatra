export function carrySourcelessLockEntry(
  entries: Record<string, string>,
  baseline: ReadonlyMap<string, string>,
  key: string,
): void {
  const prior = baseline.get(key);
  if (prior !== undefined) {
    entries[key] = prior;
  }
}
