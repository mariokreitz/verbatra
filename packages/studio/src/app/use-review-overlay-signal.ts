import { useEffect, useState } from "react";
import { reviewOverlayStore } from "./api.js";

/**
 * Subscribes to the shared {@link reviewOverlayStore} and re-renders the caller whenever it
 * changes (an approve, a reject, or a successfully accepted edit). The store itself, not this
 * hook's own return value, is the source of truth; the returned number exists only to give React a
 * changed value to react to.
 */
export function useReviewOverlaySignal(): number {
  const [tick, setTick] = useState(0);

  useEffect(() => reviewOverlayStore.subscribe(() => setTick((current) => current + 1)), []);

  return tick;
}
