import type { TranslationEntry } from "@verbatra/core";
import { createDefaultRegistry, createNextIntlJsonAdapter } from "@verbatra/format-adapters";
import { describe, expect, it } from "vitest";
import { gateCandidateValue } from "./integrity-gate.js";

function i18nextAdapter() {
  const resolution = createDefaultRegistry().resolve("", { format: "i18next-json" });
  if (resolution.status !== "resolved") {
    throw new Error("i18next adapter did not resolve");
  }
  return resolution.adapter;
}

function entry(value: string, placeholders: readonly string[] = []): TranslationEntry {
  return { key: "k", namespace: "en", value, placeholders, isPlural: false };
}

describe("gateCandidateValue: placeholder-only formats", () => {
  const adapter = i18nextAdapter();

  it("accepts a candidate whose placeholders match the source", () => {
    const result = gateCandidateValue(
      entry("Hello {{name}}", ["{{name}}"]),
      "Hallo {{name}}",
      adapter,
    );
    expect(result).toEqual({ accepted: true });
  });

  it("rejects a candidate missing a source placeholder", () => {
    const result = gateCandidateValue(entry("Hello {{name}}", ["{{name}}"]), "Hallo", adapter);
    expect(result).toEqual({ accepted: false, reason: "placeholder" });
  });

  it("always accepts message validity for a non-ICU format regardless of content", () => {
    const result = gateCandidateValue(entry("Hello", []), "anything { unbalanced", adapter);
    expect(result).toEqual({ accepted: true });
  });
});

describe("gateCandidateValue: ICU-capable formats (branch-aware comparePlaceholders + validateMessage)", () => {
  const adapter = createNextIntlJsonAdapter();

  it("rejects a placeholder invented in a single target branch before validateMessage ever runs", () => {
    const source = entry("{count, plural, one {# item} other {# items}}", ["{count}"]);
    const candidate = "{count, plural, one {# item} other {# items by {author}}}";
    const result = gateCandidateValue(source, candidate, adapter);
    expect(result).toEqual({ accepted: false, reason: "placeholder" });
  });

  it("accepts a well-formed ICU candidate whose branch-aware placeholders match", () => {
    const source = entry("{count, plural, one {One} other {# items}}", ["{count}"]);
    const candidate = "{count, plural, one {Eins} other {# Elemente}}";
    const result = gateCandidateValue(source, candidate, adapter);
    expect(result).toEqual({ accepted: true });
  });

  it("rejects a malformed ICU candidate that nonetheless matches on placeholders", () => {
    const source = entry("Hello world", []);
    const candidate = "Hallo {name";
    const result = gateCandidateValue(source, candidate, adapter);
    expect(result).toEqual({ accepted: false, reason: "icu" });
  });
});
