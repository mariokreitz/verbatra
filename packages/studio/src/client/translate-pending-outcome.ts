import type { LocaleSummary } from "@verbatra/sdk";
import type { RpcCallResult } from "./rpc-client.js";

export interface WithheldBreakdown {
  readonly integrityMismatches: number;
  readonly providerFailures: number;
  readonly budgetWithheld: number;
}

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
