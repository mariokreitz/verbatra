/** A sliding-window rate rule: at most `maxCalls` within any rolling `windowMs` window. */
export interface RateLimitRule {
  readonly windowMs: number;
  readonly maxCalls: number;
}

/**
 * A process-scoped rate limiter over RPC method names, applied at the dispatch layer before a
 * handler is invoked: a rate-limited call never reaches the sdk seam, a provider, or disk. State
 * lives for one server instance's lifetime and is never shared across processes.
 */
export interface RpcRateLimiter {
  /**
   * Reports whether a call to `method` is allowed now. An allowed call consumes a slot in the
   * method's window; a rejected call consumes nothing, so repeated over-limit calls keep failing
   * until the window rolls past earlier allowed calls. A method with no configured rule is always
   * allowed and records nothing.
   */
  tryAcquire(method: string): boolean;
}

/**
 * Builds an {@link RpcRateLimiter} enforcing one sliding-window rule per configured method name;
 * every other method is always allowed.
 *
 * @param rules - Rate rules keyed by RPC method name.
 * @param now - Clock returning milliseconds; injectable so tests never depend on a real clock.
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
