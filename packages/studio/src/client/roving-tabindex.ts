const ROVING_KEYS = ["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft", "Home", "End"] as const;

type RovingKey = (typeof ROVING_KEYS)[number];

function isRovingKey(key: string): key is RovingKey {
  return (ROVING_KEYS as readonly string[]).includes(key);
}

/**
 * Computes the next roving-tabindex focus index for a one-dimensional list of `itemCount` items,
 * given the currently focused index and a keyboard event's `key`. Returns `null` for any key this
 * primitive does not handle (including every key when `itemCount` is zero or negative), so a
 * caller can fall through to its own handling instead of treating `null` as an error.
 *
 * `ArrowDown`/`ArrowRight` move forward, `ArrowUp`/`ArrowLeft` move backward, both wrapping at the
 * ends (forward from the last item lands on the first, backward from the first lands on the
 * last), matching the usual listbox roving-tabindex pattern. `Home` and `End` jump to the first
 * and last item.
 *
 * Pure math only, with no DOM or React dependency: this package's first focus-management consumer
 * is the key detail drawer's focus trap (`app/use-dialog-a11y.ts`), which does not need roving
 * tabindex since it holds one focusable region, not a list of items. This helper is introduced
 * now as the shared primitive a future keyboard-navigable grid will import; nothing wires it to a
 * component yet.
 */
export function nextRovingIndex(
  currentIndex: number,
  key: string,
  itemCount: number,
): number | null {
  if (itemCount <= 0 || !isRovingKey(key)) {
    return null;
  }
  if (key === "Home") {
    return 0;
  }
  if (key === "End") {
    return itemCount - 1;
  }
  const delta = key === "ArrowDown" || key === "ArrowRight" ? 1 : -1;
  return (currentIndex + delta + itemCount) % itemCount;
}
