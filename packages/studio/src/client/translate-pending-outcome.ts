import type { LocaleSummary } from "@verbatra/sdk";
import type { RpcCallResult } from "./rpc-client.js";

/**
 * The per-reason counts of keys a run withheld: how many failed the placeholder-integrity check,
 * how many had no usable provider translation, and how many were never sent because a token budget
 * tripped. Summed across every locale of one run.
 */
export interface WithheldBreakdown {
  readonly integrityMismatches: number;
  readonly providerFailures: number;
  readonly budgetWithheld: number;
}

/**
 * The four outcomes a `translation.translatePending` call can settle to, ready to render.
 * Distinct from `RetranslateOutcome`: that RPC's result is the two-armed accepted/rejected shape;
 * this one wraps the sdk's own `RunSummary`, whose per-locale results are isolated data on an
 * otherwise-successful response, not a rejection. A run where a locale accepted nothing is a
 * `partial-failure` naming which locales failed; a run where every locale made progress but some
 * keys were withheld is a `withheld`, carrying the withheld total and its per-reason breakdown and
 * naming the partial locales; neither collapses into `success` or into the transport/domain `error`
 * kind.
 */
export type TranslatePendingOutcome =
  | { readonly kind: "success" }
  | { readonly kind: "partial-failure"; readonly failedLocales: readonly string[] }
  | {
      readonly kind: "withheld";
      readonly withheldCount: number;
      readonly partialLocales: readonly string[];
      readonly breakdown: WithheldBreakdown;
    }
  | { readonly kind: "error"; readonly message: string };

function sumWithheldBreakdown(locales: readonly LocaleSummary[]): WithheldBreakdown {
  let integrityMismatches = 0;
  let providerFailures = 0;
  let budgetWithheld = 0;
  for (const locale of locales) {
    integrityMismatches += locale.integrityMismatches.length;
    providerFailures += locale.providerFailures.length;
    budgetWithheld += locale.budgetWithheld.length;
  }
  return { integrityMismatches, providerFailures, budgetWithheld };
}

/**
 * Derives the render-ready outcome from a `translation.translatePending` RPC response. An RPC-layer
 * error (`ok: false`, transport or domain, including `ALREADY_IN_PROGRESS` and
 * `METHOD_RATE_LIMITED`) maps to `error`. A successful response (`ok: true`) is classified in
 * precedence order: `RunSummary.failed` naming one or more locales maps to `partial-failure`,
 * naming them; otherwise `RunSummary.partial` naming one or more locales maps to `withheld`, summing
 * the withheld key counts across all locales into a per-reason breakdown and naming the partial
 * locales; every other successful response, including a genuine no-op that translated and withheld
 * nothing, maps to `success`.
 */
export function deriveTranslatePendingOutcome(
  response: RpcCallResult<"translation.translatePending">,
): TranslatePendingOutcome {
  if (!response.ok) {
    return { kind: "error", message: response.error.message };
  }
  const summary = response.result;
  if (summary.failed.length > 0) {
    return { kind: "partial-failure", failedLocales: summary.failed };
  }
  if (summary.partial.length > 0) {
    const breakdown = sumWithheldBreakdown(summary.locales);
    const withheldCount =
      breakdown.integrityMismatches + breakdown.providerFailures + breakdown.budgetWithheld;
    return { kind: "withheld", withheldCount, partialLocales: summary.partial, breakdown };
  }
  return { kind: "success" };
}
