export interface RateLimitRule {
  readonly windowMs: number;
  readonly maxCalls: number;
}

export interface RpcRateLimiter {
  tryAcquire(method: string): boolean;
}

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
