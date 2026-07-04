import { checkPlaceholders } from "@verbatra/core";
import { describe, expect, it } from "vitest";
import { createArbAdapter } from "./arb/arb-adapter.js";
import { createI18nextJsonAdapter } from "./i18next/i18next-adapter.js";
import { analyzeIcuValue } from "./icu/analyze.js";
import { createNgxTranslateJsonAdapter } from "./ngx-translate/ngx-translate-adapter.js";
import { createVueI18nJsonAdapter } from "./vue-i18n/vue-i18n-adapter.js";
import { createXliffAdapter } from "./xliff/xliff-adapter.js";
import { createYamlAdapter } from "./yaml/yaml-adapter.js";

describe("placeholder integrity is multiset-aware end to end", () => {
  it("i18next: dropping a repeated occurrence is a mismatch", () => {
    const adapter = createI18nextJsonAdapter();
    const source = adapter.extractPlaceholders("{{count}} of {{count}}");
    const translated = adapter.extractPlaceholders("{{count}} total");
    const result = checkPlaceholders(source, translated);
    expect(result.matches).toBe(false);
    expect(result.missing).toEqual(["{{count}}"]);
  });

  it("i18next: dropping a $t() nesting reference is a mismatch", () => {
    const adapter = createI18nextJsonAdapter();
    const source = adapter.extractPlaceholders("$t(common.greeting) {{name}}");
    const translated = adapter.extractPlaceholders("Hallo {{name}}");
    const result = checkPlaceholders(source, translated);
    expect(result.matches).toBe(false);
    expect(result.missing).toEqual(["$t(common.greeting)"]);
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

  it("yaml: dropping a repeated {{count}} occurrence is a mismatch", () => {
    const adapter = createYamlAdapter();
    const source = adapter.extractPlaceholders("{{count}} of {{count}}");
    const translated = adapter.extractPlaceholders("{{count}} total");
    const result = checkPlaceholders(source, translated);
    expect(result.matches).toBe(false);
    expect(result.missing).toEqual(["{{count}}"]);
  });

  it("arb: dropping {author} from one ICU plural branch is a mismatch", () => {
    const adapter = createArbAdapter();
    const source = adapter.extractPlaceholders(
      "{count, plural, one {# by {author}} other {# by {author}}}",
    );
    const translated = adapter.extractPlaceholders(
      "{count, plural, one {# by {author}} other {#}}",
    );
    const result = checkPlaceholders(source, translated);
    expect(result.matches).toBe(false);
    expect(result.missing).toEqual(["{author}"]);
  });

  it("xliff: dropping an inline placeholder element is a mismatch", () => {
    const adapter = createXliffAdapter();
    const source = adapter.extractPlaceholders('Hello <x id="1"/> and <x id="2"/>');
    const translated = adapter.extractPlaceholders('Hallo <x id="1"/>');
    const result = checkPlaceholders(source, translated);
    expect(result.matches).toBe(false);
    expect(result.missing).toEqual(['<x id="2"/>']);
  });

  it("a faithful translation that preserves every occurrence still matches", () => {
    const adapter = createI18nextJsonAdapter();
    const source = adapter.extractPlaceholders("{{count}} of {{count}}");
    const translated = adapter.extractPlaceholders("{{count}} von {{count}}");
    expect(checkPlaceholders(source, translated).matches).toBe(true);
  });

  it("arb: a correct en to pl plural translation matches despite pl having four CLDR categories against en's two", () => {
    const adapter = createArbAdapter();
    const source = adapter.extractPlaceholders(
      "{count, plural, one {{name} has # apple} other {{name} has # apples}}",
    );
    const translated = adapter.extractPlaceholders(
      "{count, plural, one {{name} ma # jablko} few {{name} ma # jablka} many {{name} ma # jablek} other {{name} ma # jablka}}",
    );
    expect(checkPlaceholders(source, translated).matches).toBe(true);
  });

  it("arb: a correct en to ar plural translation matches despite ar having six CLDR categories against en's two", () => {
    const adapter = createArbAdapter();
    const source = adapter.extractPlaceholders(
      "{count, plural, one {{name} has # apple} other {{name} has # apples}}",
    );
    const translated = adapter.extractPlaceholders(
      "{count, plural, zero {{name} 0} one {{name} 1} two {{name} 2} few {{name} 3} many {{name} 4} other {{name} 5}}",
    );
    expect(checkPlaceholders(source, translated).matches).toBe(true);
  });

  it("arb: a pl translation that drops the shared argument from one branch still fails integrity", () => {
    const adapter = createArbAdapter();
    const source = adapter.extractPlaceholders(
      "{count, plural, one {{name} has # apple} other {{name} has # apples}}",
    );
    const translated = adapter.extractPlaceholders(
      "{count, plural, one {{name} ma # jablko} few {{name} ma # jablka} many {ma # jablek} other {{name} ma # jablka}}",
    );
    const result = checkPlaceholders(source, translated);
    expect(result.matches).toBe(false);
    expect(result.missing).toEqual(["{name}"]);
  });
});
