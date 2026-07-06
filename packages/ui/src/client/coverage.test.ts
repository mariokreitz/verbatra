import { describe, expect, it } from "vitest";
import { coveragePercent, deriveStatusView } from "./coverage.js";
import type { RpcCallResult } from "./rpc-client.js";

describe("coveragePercent", () => {
  it("is 100 for a zero-key source project, never NaN or Infinity", () => {
    expect(coveragePercent({ missing: 0, stale: 0, upToDate: 0 })).toBe(100);
  });

  it("computes a rounded partial percentage", () => {
    expect(coveragePercent({ missing: 1, stale: 0, upToDate: 1 })).toBe(50);
  });

  it("rounds to the nearest whole percent", () => {
    expect(coveragePercent({ missing: 2, stale: 0, upToDate: 1 })).toBe(33);
  });

  it("is 100 when every key is up to date", () => {
    expect(coveragePercent({ missing: 0, stale: 0, upToDate: 4 })).toBe(100);
  });

  it("counts stale keys toward the denominator but not the numerator", () => {
    expect(coveragePercent({ missing: 0, stale: 1, upToDate: 1 })).toBe(50);
  });
});

describe("deriveStatusView", () => {
  it("maps a domain error to the error view, carrying its message through unchanged", () => {
    const response: RpcCallResult<"status.check"> = {
      ok: false,
      error: { code: "SOURCE_UNREADABLE", message: "The source locale file could not be read." },
    };

    expect(deriveStatusView(response)).toEqual({
      kind: "error",
      message: "The source locale file could not be read.",
    });
  });

  it("maps a successful result to loaded rows with a computed percentage per locale", () => {
    const response: RpcCallResult<"status.check"> = {
      ok: true,
      result: {
        inSync: false,
        locales: [
          { locale: "de", missing: 1, stale: 0, upToDate: 1, inSync: false },
          { locale: "fr", missing: 0, stale: 0, upToDate: 0, inSync: true },
        ],
      },
    };

    expect(deriveStatusView(response)).toEqual({
      kind: "loaded",
      inSync: false,
      rows: [
        { locale: "de", missing: 1, stale: 0, upToDate: 1, inSync: false, percent: 50 },
        { locale: "fr", missing: 0, stale: 0, upToDate: 0, inSync: true, percent: 100 },
      ],
    });
  });

  it("maps an in-sync result to an empty-locales loaded view without crashing", () => {
    const response: RpcCallResult<"status.check"> = {
      ok: true,
      result: { inSync: true, locales: [] },
    };

    expect(deriveStatusView(response)).toEqual({ kind: "loaded", inSync: true, rows: [] });
  });
});
