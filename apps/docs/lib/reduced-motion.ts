/**
 * A one-time, non-reactive read of the OS reduced-motion preference. Callers that
 * gate an imperative animation setup (canvas loops, scroll-triggered typewriters)
 * want this snapshot at effect-run time, not a live subscription that could restart
 * an in-progress animation if the preference changes mid-session.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
