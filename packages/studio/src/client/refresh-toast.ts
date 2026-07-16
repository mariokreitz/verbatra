/**
 * Pure derivation from a live-refresh `RefreshEvent` to a render-ready toast view, plus the
 * eligibility rules for attaching the "translate pending changes" action to it. Structural types
 * only, no DOM dependency (see `src/client`'s own tsconfig): `App.tsx`/`RefreshToast.tsx` are the
 * only consumers that ever render anything.
 */
import type { RefreshEvent, RefreshKeyDelta } from "../shared/sse-events.js";

/** One toast slot's render-ready view. */
export interface RefreshToastView {
  /** Which category of file changed; drives the label and the action-eligibility rule below. */
  readonly category: "source" | "targets";
  /** Human-readable heading, for example "Source changed" or "Target changed: de". */
  readonly label: string;
  /** Built only from `delta`'s nonzero fields, for example "3 changed, 1 added". */
  readonly summary: string;
  /**
   * Whether the "translate pending changes" action may attach to this toast, independent of
   * capability state (see `canTranslatePending` below, which combines this with capabilities).
   * True only for a `"source"`-reason event: the sdk's `translate` flow diffs source content
   * against a source-vs-lock-baseline comparison it acts on directly, while a `"targets"` event
   * reports a target file's own content changing, which that same flow mostly cannot see at all
   * (see the write-half addendum's architecture decision 1 for the full reasoning).
   */
  readonly actionEligible: boolean;
}

/** The two capabilities that gate the "translate pending changes" action, mirroring `canRetranslate`'s shape. */
export interface TranslatePendingCapabilities {
  readonly spend: boolean;
  readonly writeToDisk: boolean;
}

function deltaSum(delta: RefreshKeyDelta): number {
  return delta.added + delta.changed + delta.removed;
}

function buildSummary(delta: RefreshKeyDelta): string {
  const parts: string[] = [];
  if (delta.added > 0) {
    parts.push(`${delta.added} added`);
  }
  if (delta.changed > 0) {
    parts.push(`${delta.changed} changed`);
  }
  if (delta.removed > 0) {
    parts.push(`${delta.removed} removed`);
  }
  return parts.join(", ");
}

function buildLabel(reason: "source" | "targets", locale: string | undefined): string {
  if (reason === "source") {
    return "Source changed";
  }
  return locale !== undefined ? `Target changed: ${locale}` : "Target changed";
}

/**
 * Derives a render-ready toast view from a `RefreshEvent`, or `undefined` when there is nothing
 * to report: a `"lock"`-reason event (never carries a `delta`), a `delta`-absent event, or a
 * `delta` whose three counts sum to zero (a round-tripped save with no net content change).
 * `undefined` renders no toast at all, not an empty one.
 */
export function deriveRefreshToastView(event: RefreshEvent): RefreshToastView | undefined {
  if (event.reason === "lock") {
    return undefined;
  }
  if (event.delta === undefined || deltaSum(event.delta) <= 0) {
    return undefined;
  }
  return {
    category: event.reason,
    label: buildLabel(event.reason, event.locale),
    summary: buildSummary(event.delta),
    actionEligible: event.reason === "source",
  };
}

/**
 * Whether the "translate pending changes" action button should actually render: the toast's own
 * eligibility rule (see {@link RefreshToastView.actionEligible}) combined with both write
 * capabilities, matching the established "absent, not disabled" convention `canRetranslate`
 * already set. False whenever either input is false; `capabilities` is `undefined` while it has
 * not loaded yet.
 */
export function canTranslatePending(
  actionEligible: boolean,
  capabilities: TranslatePendingCapabilities | undefined,
): boolean {
  return actionEligible && capabilities?.spend === true && capabilities.writeToDisk;
}

/** One slot's next action: a new event to render, or a manual dismiss. */
export type ToastSlotAction =
  | { readonly kind: "event"; readonly event: RefreshEvent }
  | { readonly kind: "dismiss" };

/**
 * The one-toast-slot reducer: a new refresh event always replaces whatever is currently shown
 * with that event's own derived view (which may itself be `undefined`, clearing the slot); a
 * dismiss always clears to `undefined` regardless of the current view. `current` is part of the
 * signature to match a reducer shape `RefreshToast.tsx` can wire directly to `useReducer`, even
 * though the `"event"` branch does not need to inspect it: replacement is unconditional.
 */
export function nextToastSlot(
  _current: RefreshToastView | undefined,
  action: ToastSlotAction,
): RefreshToastView | undefined {
  if (action.kind === "dismiss") {
    return undefined;
  }
  return deriveRefreshToastView(action.event);
}

/** The combined response `App.tsx` derives from one live-refresh event. */
export interface HandledRefreshEvent {
  /** Every panel's own re-fetch trigger; always true, independent of whether `toast` is populated. */
  readonly bumpToken: true;
  readonly toast: RefreshToastView | undefined;
}

/**
 * Maps one `RefreshEvent` to `App.tsx`'s combined response: the existing re-fetch behavior (a
 * zero-delta or `"lock"`-reason event still bumps `refreshToken`, even though it renders no
 * toast) is regression-tested here as a pure claim, independent of the new toast derivation.
 */
export function handleRefreshEvent(event: RefreshEvent): HandledRefreshEvent {
  return { bumpToken: true, toast: deriveRefreshToastView(event) };
}
