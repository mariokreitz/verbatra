/**
 * The event shapes carried over the live-refresh SSE stream. Kept separate from `shared/rpc/`
 * (the frozen request/response contract for POST /rpc): these are server-to-client push events,
 * not RPC methods, but they are shared, type-only, and used by both the server
 * (`server/sse.ts`) and the client (`client/reconnect.ts`), so they live next to the rpc contract
 * rather than duplicated on each side.
 */

/** Which category of watched file changed: the source locale file, a target locale file, or the lock file. */
export type RefreshReason = "source" | "targets" | "lock";

/**
 * A payload-free re-fetch signal (G12): it never carries file content or a diff, only which
 * category of file changed and when. A client reacts by re-fetching whichever RPC view is
 * currently active; it never trusts this event's data directly.
 */
export interface RefreshEvent {
  readonly reason: RefreshReason;
  /** ISO-8601 timestamp of when the debounced change settled. */
  readonly at: string;
}

/** The final event a client ever receives on a stream: the server is shutting down. */
export interface ShutdownEvent {
  /** ISO-8601 timestamp of the shutdown. */
  readonly at: string;
}

/** The named SSE event types this stream ever writes, besides the heartbeat comment. */
export const SSE_EVENT_REFRESH = "refresh";
export const SSE_EVENT_SHUTDOWN = "shutdown";
