import { describe, expect, it } from "vitest";
import { describeError, failureSummary, partition } from "./locale-failure.js";
import type { LocaleSummary } from "./summary.js";

/** A minimal succeeded summary for partition tests; only `locale` and `status` are read there. */
function succeeded(locale: string): LocaleSummary {
  return {
    locale,
    status: "succeeded",
    translated: [],
    unchanged: [],
    orphaned: [],
    pruned: [],
    invalidIcuSource: [],
    integrityMismatches: [],
    providerFailures: [],
    generated: [],
    notices: [],
  };
}

describe("describeError", () => {
  it("preserves a string code carried on an Error", () => {
    const error = Object.assign(new Error("provider blew up"), { code: "PROVIDER_ERROR" });
    expect(describeError(error)).toEqual({ code: "PROVIDER_ERROR", message: "provider blew up" });
  });

  it("falls back to LOCALE_FAILED when an Error's code is not a string", () => {
    const error = Object.assign(new Error("coded oddly"), { code: 500 });
    expect(describeError(error)).toEqual({ code: "LOCALE_FAILED", message: "coded oddly" });
  });

  it("falls back to LOCALE_FAILED for an Error with no code at all", () => {
    expect(describeError(new Error("plain"))).toEqual({ code: "LOCALE_FAILED", message: "plain" });
  });

  it("stringifies a non-Error value under the LOCALE_FAILED fallback", () => {
    expect(describeError("raw failure")).toEqual({
      code: "LOCALE_FAILED",
      message: "raw failure",
    });
    expect(describeError(42)).toEqual({ code: "LOCALE_FAILED", message: "42" });
  });
});

describe("failureSummary", () => {
  it("returns a failed summary with empty lists and the structured error", () => {
    const error = Object.assign(new Error("nope"), { code: "ADAPTER_WRITE" });
    expect(failureSummary("de", error)).toEqual({
      locale: "de",
      status: "failed",
      translated: [],
      unchanged: [],
      orphaned: [],
      pruned: [],
      invalidIcuSource: [],
      integrityMismatches: [],
      providerFailures: [],
      generated: [],
      notices: [],
      error: { code: "ADAPTER_WRITE", message: "nope" },
    });
  });
});

describe("partition", () => {
  it("splits a mixed list into the succeeded and failed locale-name lists", () => {
    const summaries: readonly LocaleSummary[] = [
      succeeded("de"),
      failureSummary("fr", new Error("x")),
      succeeded("es"),
      failureSummary("it", "raw"),
    ];
    expect(partition(summaries)).toEqual({
      succeeded: ["de", "es"],
      failed: ["fr", "it"],
    });
  });

  it("returns empty lists for an empty input", () => {
    expect(partition([])).toEqual({ succeeded: [], failed: [] });
  });
});
