import { checkPlaceholders } from "@verbatra/core";
import { describe, expect, it } from "vitest";
import { createI18nextJsonAdapter } from "./i18next/i18next-adapter.js";
import { analyzeIcuValue } from "./next-intl/icu.js";
import { createNgxTranslateJsonAdapter } from "./ngx-translate/ngx-translate-adapter.js";
import { createVueI18nJsonAdapter } from "./vue-i18n/vue-i18n-adapter.js";

// Regression guard for C1 (issue #20): adapters used to Set-deduplicate placeholders
// before they reached core, which silently defeated core's multiset integrity check.
// A translation that drops one of two required occurrences must now be reported as a
// mismatch end to end (adapter extraction -> core checkPlaceholders).
describe("placeholder integrity is multiset-aware end to end (C1)", () => {
  it("i18next: dropping a repeated occurrence is a mismatch", () => {
    const adapter = createI18nextJsonAdapter();
    const source = adapter.extractPlaceholders("{{count}} of {{count}}");
    const translated = adapter.extractPlaceholders("{{count}} total");
    const result = checkPlaceholders(source, translated);
    expect(result.matches).toBe(false);
    expect(result.missing).toEqual(["{{count}}"]);
  });

  it("ngx-translate: dropping a repeated occurrence is a mismatch", () => {
    const adapter = createNgxTranslateJsonAdapter();
    const source = adapter.extractPlaceholders("{{count}} of {{count}}");
    const translated = adapter.extractPlaceholders("{{count}} total");
    expect(checkPlaceholders(source, translated).matches).toBe(false);
  });

  it("vue-i18n: dropping a repeated occurrence is a mismatch", () => {
    const adapter = createVueI18nJsonAdapter();
    const source = adapter.extractPlaceholders("{count} of {count}");
    const translated = adapter.extractPlaceholders("{count} total");
    expect(checkPlaceholders(source, translated).matches).toBe(false);
  });

  it("next-intl: dropping an occurrence inside one ICU branch is a mismatch", () => {
    const source = analyzeIcuValue(
      "{count, plural, one {# by {author}} other {# by {author}}}",
    ).placeholders;
    const translated = analyzeIcuValue(
      "{count, plural, one {# by {author}} other {#}}",
    ).placeholders;
    expect(checkPlaceholders(source, translated).matches).toBe(false);
    expect(checkPlaceholders(source, translated).missing).toEqual(["{author}"]);
  });

  it("a faithful translation that preserves every occurrence still matches", () => {
    const adapter = createI18nextJsonAdapter();
    const source = adapter.extractPlaceholders("{{count}} of {{count}}");
    const translated = adapter.extractPlaceholders("{{count}} von {{count}}");
    expect(checkPlaceholders(source, translated).matches).toBe(true);
  });
});
