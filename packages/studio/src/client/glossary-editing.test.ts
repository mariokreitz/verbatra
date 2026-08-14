import { describe, expect, it } from "vitest";
import type { GlossaryWriteResult } from "../shared/rpc/glossary.js";
import {
  deriveGlossaryWriteOutcome,
  glossaryReadOnlyReason,
  isGlossaryEditable,
} from "./glossary-editing.js";

const RESULT: GlossaryWriteResult = {
  indicator: { source: "file", path: "glossary.json" },
  entries: { brand: "Verbatra" },
  redactedTerms: [],
};

describe("deriveGlossaryWriteOutcome", () => {
  it("carries the new glossary through on success", () => {
    const outcome = deriveGlossaryWriteOutcome({ ok: true, result: RESULT });

    expect(outcome).toEqual({ kind: "success", glossary: RESULT });
  });

  it("maps a known error code to its plain copy rather than the raw message", () => {
    const outcome = deriveGlossaryWriteOutcome({
      ok: false,
      error: { code: "METHOD_RATE_LIMITED", message: "raw" },
    });

    expect(outcome.kind).toBe("error");
    expect(outcome.kind === "error" && outcome.message).toContain("Studio is limiting");
  });

  it("falls back to the server's own message for a code with no copy", () => {
    const outcome = deriveGlossaryWriteOutcome({
      ok: false,
      error: { code: "CONFIG_INVALID", message: "A glossary term must not be blank." },
    });

    expect(outcome).toEqual({ kind: "error", message: "A glossary term must not be blank." });
  });
});

describe("glossaryReadOnlyReason", () => {
  it("returns no reason for a file-backed glossary, which is the editable case", () => {
    expect(glossaryReadOnlyReason({ source: "file", path: "glossary.json" })).toBeUndefined();
    expect(isGlossaryEditable({ source: "file", path: "glossary.json" })).toBe(true);
  });

  it("explains an inline glossary by pointing at a JSON file, never at a conversion", () => {
    const reason = glossaryReadOnlyReason({ source: "inline" }) ?? "";

    expect(reason).toContain("inline");
    expect(reason).toContain("JSON file");
    expect(isGlossaryEditable({ source: "inline" })).toBe(false);
  });

  it("explains an absent glossary by describing how to create one", () => {
    const reason = glossaryReadOnlyReason({ source: "none" }) ?? "";

    expect(reason).toContain("no glossary yet");
    expect(reason).toContain("JSON file");
    expect(isGlossaryEditable({ source: "none" })).toBe(false);
  });
});
