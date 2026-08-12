import { describe, expect, it } from "vitest";
import type { JsonEnvelope } from "./harness.js";
import {
  classifyWatchEnvelope,
  type WatchLocaleSummary,
  type WatchRunSummary,
} from "./watch-outcome.js";

/**
 * Unit coverage for the throttle-versus-failure decision. It runs in the deterministic no-key tier
 * on purpose: the classifier is what keeps the live watch test able to fail, so the required gate,
 * not the quota-dependent one, is what proves the classifier is right.
 */

const TARGET = { locale: "de", key: "welcome" } as const;

/**
 * The withheld-sub-batch notice exactly as the CLI emitted it in the run that prompted this work.
 * Copied verbatim rather than paraphrased: this string is the contract the classifier reads.
 */
const REAL_RATE_LIMIT_NOTICE =
  "A sub-batch of 1 entries failed (RATE_LIMITED: The translation provider rate-limited this request.) and was withheld; it will be retried next run.";

function locale(overrides: Partial<WatchLocaleSummary> = {}): WatchLocaleSummary {
  return {
    locale: "de",
    translated: [],
    unchanged: [],
    providerFailures: [],
    integrityMismatches: [],
    budgetWithheld: [],
    notices: [],
    ...overrides,
  };
}

function record(...locales: WatchLocaleSummary[]): JsonEnvelope<WatchRunSummary> {
  return { ok: true, version: 1, command: "watch", result: { locales } };
}

describe("classifyWatchEnvelope", () => {
  it("reports a translated key as delivered", () => {
    const outcome = classifyWatchEnvelope(record(locale({ translated: ["welcome"] })), TARGET);
    expect(outcome.kind).toBe("delivered");
  });

  it("reports an already-current key as delivered, so a retry run counts the earlier success", () => {
    const outcome = classifyWatchEnvelope(record(locale({ unchanged: ["welcome"] })), TARGET);
    expect(outcome.kind).toBe("delivered");
  });

  it("reports a cache hit and a generated plural form as delivered", () => {
    expect(classifyWatchEnvelope(record(locale({ cacheHits: ["welcome"] })), TARGET).kind).toBe(
      "delivered",
    );
    expect(classifyWatchEnvelope(record(locale({ generated: ["welcome"] })), TARGET).kind).toBe(
      "delivered",
    );
  });

  it("reads the real rate-limit notice as throttling, not as a product failure", () => {
    const outcome = classifyWatchEnvelope(
      record(
        locale({
          providerFailures: ["welcome"],
          notices: [{ code: "SUB_BATCH_FAILED", message: REAL_RATE_LIMIT_NOTICE }],
        }),
      ),
      TARGET,
    );
    expect(outcome.kind).toBe("throttled");
  });

  /**
   * The whole point of the classifier. A withheld key with any other cause must stay a failure, or
   * the live test would absorb a real regression as an environment skip.
   */
  it("reports a key withheld for any other provider reason as a failure", () => {
    const outcome = classifyWatchEnvelope(
      record(
        locale({
          providerFailures: ["welcome"],
          notices: [
            {
              code: "SUB_BATCH_FAILED",
              message:
                "A sub-batch of 1 entries failed (AUTH_FAILED: The translation provider rejected the credentials.) and was withheld; it will be retried next run.",
            },
          ],
        }),
      ),
      TARGET,
    );
    expect(outcome.kind).toBe("failed");
    if (outcome.kind === "failed") {
      expect(outcome.detail).toContain("AUTH_FAILED");
    }
  });

  it("reports a key withheld with no notice at all as a failure", () => {
    const outcome = classifyWatchEnvelope(
      record(locale({ providerFailures: ["welcome"] })),
      TARGET,
    );
    expect(outcome.kind).toBe("failed");
  });

  /**
   * A loose substring match on the notice message would misread this as throttling. The code must be
   * read from the parenthesised position the SDK formats it in.
   */
  it("does not read a stray mention of the rate-limit code as throttling", () => {
    const outcome = classifyWatchEnvelope(
      record(
        locale({
          providerFailures: ["welcome"],
          notices: [
            {
              code: "SUB_BATCH_FAILED",
              message:
                "A sub-batch of 1 entries failed (PROVIDER_ERROR: the response mentioned RATE_LIMITED handling) and was withheld; it will be retried next run.",
            },
          ],
        }),
      ),
      TARGET,
    );
    expect(outcome.kind).toBe("failed");
  });

  it("reports a placeholder-integrity withholding as a failure", () => {
    const outcome = classifyWatchEnvelope(
      record(locale({ integrityMismatches: ["welcome"] })),
      TARGET,
    );
    expect(outcome.kind).toBe("failed");
  });

  it("reports a budget withholding as a failure", () => {
    const outcome = classifyWatchEnvelope(record(locale({ budgetWithheld: ["welcome"] })), TARGET);
    expect(outcome.kind).toBe("failed");
  });

  it("reports a failed run record as a failure", () => {
    const outcome = classifyWatchEnvelope(
      { ok: false, version: 1, command: "watch", code: "WATCH_RUN_FAILED", message: "boom" },
      TARGET,
    );
    expect(outcome.kind).toBe("failed");
    if (outcome.kind === "failed") {
      expect(outcome.detail).toContain("WATCH_RUN_FAILED");
    }
  });

  it("reports a locale that threw on a rate limit as throttling", () => {
    const outcome = classifyWatchEnvelope(
      record(locale({ error: { code: "RATE_LIMITED", message: "rate limited" } })),
      TARGET,
    );
    expect(outcome.kind).toBe("throttled");
  });

  it("reports a locale that threw for any other reason as a failure", () => {
    const outcome = classifyWatchEnvelope(
      record(locale({ error: { code: "SOURCE_UNREADABLE", message: "missing" } })),
      TARGET,
    );
    expect(outcome.kind).toBe("failed");
  });

  it("reports a missing summary for the awaited locale as a failure", () => {
    const outcome = classifyWatchEnvelope(record(locale({ locale: "fr" })), TARGET);
    expect(outcome.kind).toBe("failed");
  });

  /**
   * A run that started before the source change landed says nothing about the awaited key. It must
   * not be read as either outcome; the caller keeps reading records.
   */
  it("reports a run that has not reached the key yet as pending", () => {
    const outcome = classifyWatchEnvelope(record(locale({ unchanged: ["greeting"] })), TARGET);
    expect(outcome.kind).toBe("pending");
  });
});
