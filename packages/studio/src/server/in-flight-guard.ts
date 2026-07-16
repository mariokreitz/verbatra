/**
 * A process-scoped "is a matching call already running" guard over RPC method names, applied at
 * the dispatch layer before a handler is ever invoked. This is a UX/resource optimization, not a
 * correctness mechanism: `translation.translatePending`'s actual safety against duplicate spend or
 * duplicate writes comes from the sdk's own `translate` flow's per-locale write lock and its
 * lock-file-read relocation (see `packages/sdk/src/flow/translate-project.ts`), unconditionally,
 * whether or not this guard is even wired up. Without it, a second concurrent call for a guarded
 * method would still be correct, only slower: it would block on the real per-locale lock for up
 * to `acquireTimeoutMs` before discovering there was nothing left to do.
 *
 * Scoped to one server instance's lifetime (an instance is created per `createStudioServer` call,
 * mirroring `RpcRateLimiter`), never a module-level singleton: a module-level flag would leak
 * across independent server instances in the same process (for example separate test cases) and
 * make "not permanently blocked by a stuck flag" impossible to prove in isolation.
 */
export interface RpcInFlightGuard {
  /**
   * Marks `method` as in flight and reports whether this call may proceed. Only methods passed to
   * {@link createRpcInFlightGuard}'s `guardedMethods` are ever tracked; every other method always
   * returns true and is not recorded. Must be paired with exactly one later {@link leave} call for
   * the same method once that call settles (success, domain error, or an unexpected throw), or the
   * method stays blocked forever.
   */
  tryEnter(method: string): boolean;
  /** Clears `method`'s in-flight marker, allowing a later call to proceed. A no-op if not currently marked. */
  leave(method: string): void;
}

/**
 * Builds an {@link RpcInFlightGuard} tracking exactly the methods named in `guardedMethods`; every
 * other method name always returns true from {@link RpcInFlightGuard.tryEnter} and is never
 * recorded, mirroring `RpcRateLimiter`'s own "no configured rule" default.
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
