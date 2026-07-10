import type { ProviderNotice, TranslateResult } from "@verbatra/ai-providers";
import type { PlaceholderIntegrityResult } from "@verbatra/core";
import { describe, expect, it } from "vitest";
import { readNotices } from "./notices.js";

function resultWith(notices: readonly ProviderNotice[] | undefined): TranslateResult {
  const values = new Map<string, string>();
  const integrity = new Map<string, PlaceholderIntegrityResult>();
  return notices === undefined ? { values, integrity } : { values, integrity, notices };
}

const valid: ProviderNotice = { code: "GLOSSARY_IGNORED", message: "term map ignored" };

describe("readNotices", () => {
  it("returns a populated notices array unchanged (the DeepL shape)", () => {
    expect(readNotices(resultWith([valid]))).toEqual([valid]);
  });

  it("returns an empty array when the result carries a present-but-empty notices field (the LLM shape)", () => {
    expect(readNotices(resultWith([]))).toEqual([]);
  });

  it("returns an empty array when the result carries no notices field at all", () => {
    expect(readNotices(resultWith(undefined))).toEqual([]);
  });
});
