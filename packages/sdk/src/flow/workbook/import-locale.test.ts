import { contentHash, type LocaleResource, type TranslationEntry } from "@verbatra/core";
import type { WorkbookRow, WorkbookSheet } from "@verbatra/exchange";
import {
  createI18nextJsonAdapter,
  createNextIntlJsonAdapter,
  type FormatAdapter,
} from "@verbatra/format-adapters";
import { describe, expect, it } from "vitest";
import { type ImportLocaleParams, importLocale, UnknownKeyError } from "./import-locale.js";

function entry(key: string, value: string, placeholders: readonly string[] = []): TranslationEntry {
  return { key, namespace: "common", value, placeholders, isPlural: false };
}

function resource(
  locale: string,
  entries: readonly TranslationEntry[],
  format: LocaleResource["format"] = "i18next-json",
): LocaleResource {
  return {
    locale,
    namespace: "common",
    format,
    entries: new Map(entries.map((e) => [e.key, e])),
  };
}

function row(key: string, translation: string, sourceHash: string): WorkbookRow {
  return { key, source: "", currentTarget: "", status: "new", sourceHash, translation };
}

function params(over: Partial<ImportLocaleParams> & { sheet: WorkbookSheet }): ImportLocaleParams {
  return {
    source: resource("en", []),
    target: resource("de", []),
    baseline: new Map<string, string>(),
    adapter: createI18nextJsonAdapter(),
    sourceInvalidIcuKeys: [],
    ...over,
  };
}

describe("importLocale", () => {
  it("skips a filled row whose source key was deleted since export (orphaned source)", () => {
    // "gone" exists in the target file but no longer in the source: a row may still carry it from
    // an earlier export. It must not be accepted, not be judged, and not be treated as unknown.
    const sheet: WorkbookSheet = { locale: "de", rows: [row("gone", "Weg", "stale-hash")] };
    const result = importLocale(
      params({
        sheet,
        source: resource("en", []),
        target: resource("de", [entry("gone", "Gone")]),
      }),
    );

    expect(result.accepted.size).toBe(0);
    expect(result.withheld.size).toBe(0);
    expect(result.summary.translated).toEqual([]);
    expect(result.summary.integrityMismatches).toEqual([]);
    // The deleted source surfaces through the orphaned diff bucket, not as an error.
    expect(result.summary.orphaned).toEqual(["gone"]);
  });

  it("surfaces source keys flagged invalid-ICU only when they appear as a row, deduped and sorted", () => {
    const src = entry("greet", "Hi");
    const sheet: WorkbookSheet = {
      locale: "de",
      rows: [row("greet", "Hallo", contentHash(src))],
    };
    const result = importLocale(
      params({
        sheet,
        source: resource("en", [src]),
        target: resource("de", []),
        // "greet" is a row (kept, deduped); "absent" is not a row (filtered out).
        sourceInvalidIcuKeys: ["greet", "greet", "absent"],
      }),
    );

    expect(result.summary.invalidIcuSource).toEqual(["greet"]);
  });

  it("withholds a row whose value is invalid for the format's ICU syntax", () => {
    const src = entry("items", "{n, plural, one {# item} other {# items}}");
    const sheet: WorkbookSheet = {
      locale: "de",
      rows: [row("items", "{n, plural, one {x", contentHash(src))], // malformed ICU
    };
    const adapter: FormatAdapter = createNextIntlJsonAdapter();
    const result = importLocale(
      params({
        sheet,
        adapter,
        source: resource("en", [src], "next-intl-json"),
        target: resource("de", [], "next-intl-json"),
      }),
    );

    expect(result.accepted.size).toBe(0);
    expect(result.withheld).toEqual(new Set(["items"]));
    expect(result.summary.integrityMismatches).toEqual(["items"]);
  });

  it("accepts a clean filled row and throws on an invented key", () => {
    const src = entry("greet", "Hi");
    const ok: WorkbookSheet = { locale: "de", rows: [row("greet", "Hallo", contentHash(src))] };
    const accepted = importLocale(
      params({ sheet: ok, source: resource("en", [src]), target: resource("de", []) }),
    );
    expect(accepted.accepted.get("greet")?.value).toBe("Hallo");
    expect(accepted.summary.translated).toEqual(["greet"]);

    const ghost: WorkbookSheet = { locale: "de", rows: [row("ghost", "Boo", "x")] };
    expect(() =>
      importLocale(
        params({ sheet: ghost, source: resource("en", [src]), target: resource("de", []) }),
      ),
    ).toThrow(UnknownKeyError);
  });
});
