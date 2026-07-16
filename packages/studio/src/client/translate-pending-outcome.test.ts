import { describe, expect, it } from "vitest";
import type { RpcCallResult } from "./rpc-client.js";
import { deriveTranslatePendingOutcome } from "./translate-pending-outcome.js";

function ok(overrides: Partial<{ succeeded: readonly string[]; failed: readonly string[] }> = {}) {
  return {
    ok: true as const,
    result: {
      dryRun: false,
      locales: [],
      succeeded: overrides.succeeded ?? ["de", "fr"],
      failed: overrides.failed ?? [],
    },
  };
}

describe("deriveTranslatePendingOutcome", () => {
  it("maps every-locale-succeeded to success", () => {
    const response = ok({ succeeded: ["de", "fr"], failed: [] });
    expect(deriveTranslatePendingOutcome(response)).toEqual({ kind: "success" });
  });

  it("maps a RunSummary carrying one or more failed locales to partial-failure, naming them", () => {
    const response = ok({ succeeded: ["de"], failed: ["fr", "es"] });
    expect(deriveTranslatePendingOutcome(response)).toEqual({
      kind: "partial-failure",
      failedLocales: ["fr", "es"],
    });
  });

  it("maps a transport/domain RPC error to the error kind, carrying its message", () => {
    const response: RpcCallResult<"translation.translatePending"> = {
      ok: false,
      error: { code: "RATE_LIMITED", message: "Too many calls to this method." },
    };
    expect(deriveTranslatePendingOutcome(response)).toEqual({
      kind: "error",
      message: "Too many calls to this method.",
    });
  });

  it("maps ALREADY_IN_PROGRESS to the error kind, not a distinct fourth kind", () => {
    const response: RpcCallResult<"translation.translatePending"> = {
      ok: false,
      error: { code: "ALREADY_IN_PROGRESS", message: "A matching call is already in progress." },
    };
    expect(deriveTranslatePendingOutcome(response)).toEqual({
      kind: "error",
      message: "A matching call is already in progress.",
    });
  });
});
