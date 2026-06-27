import type { ProviderNotice, TranslateResult } from "@verbatra/ai-providers";
import type { PlaceholderIntegrityResult } from "@verbatra/core";
import { describe, expect, it } from "vitest";
import { readNotices } from "./notices.js";

/** Build a result carrying an arbitrary `notices` value (the field the reader probes structurally). */
function resultWith(notices: unknown): TranslateResult {
  const values = new Map<string, string>();
  const integrity = new Map<string, PlaceholderIntegrityResult>();
  return { values, integrity, notices } as TranslateResult;
}

/** A result with no `notices` field at all (the LLM shape). */
function bareResult(): TranslateResult {
  return {
    values: new Map<string, string>(),
    integrity: new Map<string, PlaceholderIntegrityResult>(),
  };
}

const valid: ProviderNotice = { code: "GLOSSARY_IGNORED", message: "term map ignored" };

describe("readNotices", () => {
  it("returns a valid notices array unchanged", () => {
    expect(readNotices(resultWith([valid]))).toEqual([valid]);
  });

  it("returns an empty array when the result carries no notices field (the LLM shape)", () => {
    expect(readNotices(bareResult())).toEqual([]);
  });

  it("returns an empty array when notices is present but not an array", () => {
    expect(readNotices(resultWith("not-an-array"))).toEqual([]);
    expect(readNotices(resultWith({ code: "X", message: "Y" }))).toEqual([]);
  });

  it("filters out every malformed entry and keeps only well-formed notices", () => {
    const second: ProviderNotice = { code: "FORMALITY_DOWNGRADED", message: "downgraded" };
    const candidate = [
      valid,
      null,
      42,
      "string",
      { message: "no code" },
      { code: 7, message: "code not a string" },
      { code: "missing-message" },
      { code: "bad-message", message: 9 },
      second,
    ];
    expect(readNotices(resultWith(candidate))).toEqual([valid, second]);
  });
});
