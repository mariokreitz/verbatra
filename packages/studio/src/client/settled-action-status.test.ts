import { describe, expect, it } from "vitest";
import { settledActionStatusLabel } from "./settled-action-status.js";

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
