import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LocaleResource, SupportedFormat } from "@verbatra/core";
import { describe, expect, it } from "vitest";
import type { FormatAdapter } from "../adapter.js";
import { createI18nextJsonAdapter } from "../i18next/i18next-adapter.js";
import { createNextIntlJsonAdapter } from "../next-intl/next-intl-adapter.js";
import { createNgxTranslateJsonAdapter } from "../ngx-translate/ngx-translate-adapter.js";
import { createVueI18nJsonAdapter } from "../vue-i18n/vue-i18n-adapter.js";

const EXPECTED = `{\n  "greeting": "Hi"\n}\n`;

const adapters: ReadonlyArray<{ format: SupportedFormat; make: () => FormatAdapter }> = [
  { format: "i18next-json", make: createI18nextJsonAdapter },
  { format: "vue-i18n-json", make: createVueI18nJsonAdapter },
  { format: "next-intl-json", make: createNextIntlJsonAdapter },
  { format: "ngx-translate-json", make: createNgxTranslateJsonAdapter },
];

function singleKey(format: SupportedFormat): LocaleResource {
  return {
    locale: "en",
    namespace: "en",
    format,
    entries: new Map([
      [
        "greeting",
        { key: "greeting", namespace: "en", value: "Hi", placeholders: [], isPlural: false },
      ],
    ]),
  };
}

describe("QA independent: byte-identical write through the atomic path, all four adapters", () => {
  for (const { format, make } of adapters) {
    it(`${format} writes the expected bytes with no leftover temp`, async () => {
      const dir = await mkdtemp(join(tmpdir(), "verbatra-qa-aw-"));
      const target = join(dir, "en.json");
      await make().write(singleKey(format), target);
      expect(await readFile(target, "utf8")).toBe(EXPECTED);
      expect(await readdir(dir)).toEqual(["en.json"]);
    });
  }
});
