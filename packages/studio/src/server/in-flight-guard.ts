export interface RpcInFlightGuard {
  tryEnter(method: string): boolean;
  leave(method: string): void;
}

export function createRpcInFlightGuard(guardedMethods: ReadonlySet<string>): RpcInFlightGuard {
  const inFlight = new Set<string>();

  return {
    tryEnter(method: string): boolean {
      if (!guardedMethods.has(method)) {
        return true;
      }
      if (inFlight.has(method)) {
        return false;
      }
      inFlight.add(method);
      return true;
    },
    leave(method: string): void {
      inFlight.delete(method);
    },
  };
}
