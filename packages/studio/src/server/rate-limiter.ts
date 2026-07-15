/** A fixed-window rate rule: at most `maxCalls` within any rolling `windowMs` window. */
export interface RateLimitRule {
  readonly windowMs: number;
  readonly maxCalls: number;
}

/**
 * A process-scoped rate limiter over RPC method names, applied at the dispatch layer before a
 * handler is ever invoked (a rate-limited call never reaches the sdk seam, the provider, or disk).
 * Scoped to a single server instance's lifetime, matching Studio's single-loopback-session design;
 * holds no state across separate processes.
 */
export interface RpcRateLimiter {
  /**
   * Records one call attempt for `method` now and reports whether it is allowed. A method with no
   * configured rule is always allowed and records nothing.
   */
  tryAcquire(method: string): boolean;
}

/**
 * Builds an {@link RpcRateLimiter} enforcing one fixed-window rule per rate-limited method name;
 * every other method is always allowed. `now` is injectable so tests never depend on a real clock.
 */
export function createRpcRateLimiter(
  rules: Readonly<Record<string, RateLimitRule>>,
  now: () => number = Date.now,
): RpcRateLimiter {
  const recentCalls = new Map<string, number[]>();

  return {
    tryAcquire(method: string): boolean {
      const rule = rules[method];
      if (rule === undefined) {
        return true;
      }
      const current = now();
      const windowStart = current - rule.windowMs;
      const withinWindow = (recentCalls.get(method) ?? []).filter(
        (timestamp) => timestamp > windowStart,
      );
      if (withinWindow.length >= rule.maxCalls) {
        recentCalls.set(method, withinWindow);
        return false;
      }
      withinWindow.push(current);
      recentCalls.set(method, withinWindow);
      return true;
    },
  };
}
