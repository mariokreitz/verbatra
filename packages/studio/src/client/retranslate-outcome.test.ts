import { describe, expect, it } from "vitest";
import { deriveRetranslateOutcome } from "./retranslate-outcome.js";

describe("deriveRetranslateOutcome", () => {
  it("reports success for an accepted result", () => {
    const outcome = deriveRetranslateOutcome({
      ok: true,
      result: { accepted: true, value: "Hallo", reviewReasons: [] },
    });
    expect(outcome).toEqual({ kind: "success" });
  });

  it("reports rejected with the reason for a well-formed but rejected candidate", () => {
    const outcome = deriveRetranslateOutcome({
      ok: true,
      result: { accepted: false, reason: "placeholder", value: "Hallo" },
    });
    expect(outcome).toEqual({ kind: "rejected", reason: "placeholder" });
  });

  it("reports the icu rejection reason distinctly from placeholder", () => {
    const outcome = deriveRetranslateOutcome({
      ok: true,
      result: { accepted: false, reason: "icu", value: "Hallo {name" },
    });
    expect(outcome).toEqual({ kind: "rejected", reason: "icu" });
  });

  it("reports error with the message for a transport or domain-error response", () => {
    const outcome = deriveRetranslateOutcome({
      ok: false,
      error: { code: "UNKNOWN_KEY", message: "The key was not found." },
    });
    expect(outcome).toEqual({ kind: "error", message: "The key was not found." });
  });
});
