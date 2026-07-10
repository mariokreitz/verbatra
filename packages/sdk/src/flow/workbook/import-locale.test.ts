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
    // "gone" exists in the target but no longer in the source: a stale row from an earlier export must not be accepted, judged, or treated as unknown.
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

  it("accepts a filled row that reorders the same placeholder multiset", () => {
    // A German rendering swaps the two placeholders; the multiset is unchanged, so the row is accepted.
    const src = entry("pair", "{{a}} {{b}}", ["{{a}}", "{{b}}"]);
    const sheet: WorkbookSheet = {
      locale: "de",
      rows: [row("pair", "{{b}} und {{a}}", contentHash(src))],
    };
    const result = importLocale(
      params({ sheet, source: resource("en", [src]), target: resource("de", []) }),
    );

    expect(result.accepted.get("pair")?.value).toBe("{{b}} und {{a}}");
    expect(result.summary.translated).toEqual(["pair"]);
    expect(result.summary.integrityMismatches).toEqual([]);
  });

  it("reports no notice for a blank row whose source key was deleted since export", () => {
    const sheet: WorkbookSheet = { locale: "de", rows: [row("gone", "", "stale-hash")] };
    const result = importLocale(
      params({
        sheet,
        source: resource("en", []),
        target: resource("de", [entry("gone", "Gone")]),
        baseline: new Map([["gone", "stale-hash"]]),
      }),
    );

    expect(result.summary.notices).toEqual([]);
  });

  it("reports no notice for a blank row whose source did not drift", () => {
    const src = entry("greet", "Hi");
    const sheet: WorkbookSheet = { locale: "de", rows: [row("greet", "", contentHash(src))] };
    const result = importLocale(
      params({
        sheet,
        source: resource("en", [src]),
        target: resource("de", [entry("greet", "Hallo")]),
        baseline: new Map([["greet", contentHash(src)]]),
      }),
    );

    expect(result.accepted.size).toBe(0);
    expect(result.withheld.size).toBe(0);
    expect(result.summary.notices).toEqual([]);
  });

  it("reports a retained-baseline notice for a blank row whose source drifted", () => {
    const oldSrc = entry("greet", "Hi");
    const newSrc = entry("greet", "Hi there");
    const sheet: WorkbookSheet = { locale: "de", rows: [row("greet", "", contentHash(newSrc))] };
    const result = importLocale(
      params({
        sheet,
        source: resource("en", [newSrc]),
        target: resource("de", [entry("greet", "Hallo")]),
        baseline: new Map([["greet", contentHash(oldSrc)]]),
      }),
    );

    expect(result.accepted.size).toBe(0);
    expect(result.withheld.size).toBe(0);
    expect(result.summary.notices).toEqual([
      { code: "BLANK_ROW_BASELINE_RETAINED", message: expect.any(String) },
    ]);
  });

  it("flags a placeholder invented in a single target branch via the adapter's comparePlaceholders", () => {
    // Without branch-aware comparison this would flatten to a match (the BTS-104 bug): {author} is
    // confined to the "other" branch of the row's translation and absent everywhere in the source.
    const src = entry("items", "{count, plural, one {# item} other {# items}}");
    const sheet: WorkbookSheet = {
      locale: "de",
      rows: [
        row("items", "{count, plural, one {# item} other {# items by {author}}}", contentHash(src)),
      ],
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

  it("still flags a placeholder dropped from a single target branch via comparePlaceholders", () => {
    const src = entry("items", "{count, plural, one {# by {author}} other {# by {author}}}");
    const sheet: WorkbookSheet = {
      locale: "de",
      rows: [row("items", "{count, plural, one {# by {author}} other {#}}", contentHash(src))],
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

    expect(result.withheld).toEqual(new Set(["items"]));
    expect(result.summary.integrityMismatches).toEqual(["items"]);
  });

  it("accepts a row that keeps a source-only-partial placeholder in its matching branch via comparePlaceholders", () => {
    const src = entry("msg", "{count, plural, one {One msg from {sender}} other {# messages}}");
    const sheet: WorkbookSheet = {
      locale: "de",
      rows: [
        row(
          "msg",
          "{count, plural, one {Eine Nachricht von {sender}} other {# Nachrichten}}",
          contentHash(src),
        ),
      ],
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

    expect(result.accepted.get("msg")?.value).toBe(
      "{count, plural, one {Eine Nachricht von {sender}} other {# Nachrichten}}",
    );
    expect(result.summary.integrityMismatches).toEqual([]);
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
