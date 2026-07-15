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
 * A locale file's added, changed, and removed key counts since that same file's own last observed
 * snapshot: a plain content diff of the file against itself at two points in time, independent of
 * source drift or the lock baseline. Counts only; never carries a key name or a value.
 */
export interface RefreshKeyDelta {
  readonly added: number;
  readonly changed: number;
  readonly removed: number;
}

/**
 * A re-fetch signal (G12): it never carries file content, a key name, or a translated value, only
 * which category of file changed, when, and (for "source" and "targets") which locale and how many
 * of its keys look added, changed, or removed since that file's own last observed snapshot. A
 * "lock" event carries neither `locale` nor `delta`, unchanged from before this field was added. A
 * client reacts by re-fetching whichever RPC view is currently active; it never trusts this event's
 * counts as authoritative on their own.
 */
export interface RefreshEvent {
  readonly reason: RefreshReason;
  /** ISO-8601 timestamp of when the debounced change settled. */
  readonly at: string;
  /** Which locale's file changed; present for "source" and "targets", absent for "lock". */
  readonly locale?: string;
  /** The changed locale's key delta since its last observed snapshot; present alongside `locale`. */
  readonly delta?: RefreshKeyDelta;
}

/** The final event a client ever receives on a stream: the server is shutting down. */
export interface ShutdownEvent {
  /** ISO-8601 timestamp of the shutdown. */
  readonly at: string;
}

/** The named SSE event types this stream ever writes, besides the heartbeat comment. */
export const SSE_EVENT_REFRESH = "refresh";
export const SSE_EVENT_SHUTDOWN = "shutdown";
