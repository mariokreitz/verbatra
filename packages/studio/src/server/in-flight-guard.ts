/**
 * A guard that blocks a second concurrent call to the same guarded RPC method, applied at the
 * dispatch layer before a handler runs. It is a resource and UX optimization, not a correctness
 * mechanism: guarded translation methods stay safe against duplicate writes through the sdk's own
 * per-locale write lock whether or not this guard is wired up. Each guard instance belongs to one
 * server instance, never a module-level singleton, so independent servers in the same process
 * (for example separate test cases) cannot leak in-flight state into each other.
 */
export interface RpcInFlightGuard {
  /**
   * Marks `method` as in flight and reports whether this call may proceed. Only methods passed to
   * {@link createRpcInFlightGuard} as `guardedMethods` are tracked; every other method always
   * returns true and is not recorded. Pair each successful entry with exactly one later
   * {@link leave} call once the guarded call settles, or the method stays blocked forever.
   */
  tryEnter(method: string): boolean;
  /** Clears `method`'s in-flight marker, allowing a later call to proceed. A no-op if not currently marked. */
  leave(method: string): void;
}

/**
 * Builds an {@link RpcInFlightGuard} that tracks exactly the methods named in `guardedMethods`;
 * every other method name always passes {@link RpcInFlightGuard.tryEnter} and is never recorded.
 *
 * @param guardedMethods - The RPC method names to guard.
 */
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
