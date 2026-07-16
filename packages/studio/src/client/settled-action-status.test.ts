import { describe, expect, it } from "vitest";
import { settledActionStatusClassName, settledActionStatusLabel } from "./settled-action-status.js";

describe("settledActionStatusLabel", () => {
  it("uses the caller-provided label on success", () => {
    expect(settledActionStatusLabel({ kind: "success" }, "Saved")).toBe("Saved");
    expect(settledActionStatusLabel({ kind: "success" }, "Retranslated")).toBe("Retranslated");
  });

  it("reports the placeholder rejection reason", () => {
    expect(settledActionStatusLabel({ kind: "rejected", reason: "placeholder" }, "Saved")).toBe(
      "Rejected: placeholder mismatch",
    );
  });

  it("reports the icu rejection reason distinctly from placeholder", () => {
    expect(settledActionStatusLabel({ kind: "rejected", reason: "icu" }, "Saved")).toBe(
      "Rejected: invalid message syntax",
    );
  });

  it("prefixes an error outcome's message", () => {
    expect(
      settledActionStatusLabel({ kind: "error", message: "The key was not found." }, "Saved"),
    ).toBe("Failed: The key was not found.");
  });
});

describe("settledActionStatusClassName", () => {
  it("returns the neutral className when nothing has settled yet", () => {
    expect(settledActionStatusClassName(undefined)).toBe("retranslate-status");
  });

  it("returns the success className for a success outcome", () => {
    expect(settledActionStatusClassName({ kind: "success" })).toBe(
      "retranslate-status retranslate-status-success",
    );
  });

  it("returns the error className for a rejected outcome", () => {
    expect(settledActionStatusClassName({ kind: "rejected", reason: "placeholder" })).toBe(
      "retranslate-status retranslate-status-error",
    );
  });

  it("returns the error className for an error outcome", () => {
    expect(settledActionStatusClassName({ kind: "error", message: "boom" })).toBe(
      "retranslate-status retranslate-status-error",
    );
  });
});
