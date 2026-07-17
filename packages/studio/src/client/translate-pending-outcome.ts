import type { RpcCallResult } from "./rpc-client.js";

/**
 * The three outcomes a `translation.translatePending` call can settle to, ready to render.
 * Distinct from `RetranslateOutcome`: that RPC's result is the two-armed accepted/rejected shape;
 * this one wraps the sdk's own `RunSummary`, whose per-locale failures are isolated data on an
 * otherwise-successful response, not a rejection, so a partial failure is its own outcome kind,
 * naming which locales failed, rather than collapsed into "success" or into the transport/domain
 * `error` kind.
 */
export type TranslatePendingOutcome =
  | { readonly kind: "success" }
  | { readonly kind: "partial-failure"; readonly failedLocales: readonly string[] }
  | { readonly kind: "error"; readonly message: string };

/**
 * Derives the render-ready outcome from a `translation.translatePending` RPC response. An RPC-layer
 * error (`ok: false`, transport or domain, including `ALREADY_IN_PROGRESS` and
 * `METHOD_RATE_LIMITED`) maps
 * to `error`; a successful response (`ok: true`) whose `RunSummary.failed` names one or more
 * locales maps to `partial-failure`, naming them; every other successful response maps to
 * `success`.
 */
export function deriveTranslatePendingOutcome(
  response: RpcCallResult<"translation.translatePending">,
): TranslatePendingOutcome {
  if (!response.ok) {
    return { kind: "error", message: response.error.message };
  }
  if (response.result.failed.length > 0) {
    return { kind: "partial-failure", failedLocales: response.result.failed };
  }
  return { kind: "success" };
}
