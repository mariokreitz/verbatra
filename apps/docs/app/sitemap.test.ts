import { describe, expect, it, vi } from "vitest";

/**
 * The real `source` loads the generated `.source` tree, so the sitemap's page set would
 * drift with every content change. A small fake keeps the assertions about the parts the
 * sitemap itself owns: entry order, priorities, and the hreflang alternates. `@/lib/i18n`
 * is deliberately NOT mocked, so a reorder of `i18n.languages` still shows up here.
 */
interface FakePage {
  readonly slugs: readonly string[];
  readonly url: string;
}

const PAGES: Record<string, readonly FakePage[]> = {
  en: [
    { slugs: ["intro"], url: "/docs/intro" },
    { slugs: ["english-only"], url: "/docs/english-only" },
  ],
  de: [{ slugs: ["intro"], url: "/de/docs/intro" }],
  es: [{ slugs: ["intro"], url: "/es/docs/intro" }],
  fr: [{ slugs: ["intro"], url: "/fr/docs/intro" }],
};

vi.mock("@/lib/source", () => ({
  source: {
    getPages: (locale: string) => PAGES[locale] ?? [],
    getPage: (slugs: readonly string[], locale: string) =>
      (PAGES[locale] ?? []).find((page) => page.slugs.join("/") === slugs.join("/")),
  },
}));

const { default: sitemap } = await import("./sitemap");

const ORIGIN = "https://verbatra.kreitz-webdev.de";

const HOME_LANGUAGES = {
  en: `${ORIGIN}/`,
  de: `${ORIGIN}/de`,
  es: `${ORIGIN}/es`,
  fr: `${ORIGIN}/fr`,
};

describe("sitemap", () => {
  it("emits the locale roots first, in the configured locale order, then the docs pages", () => {
    expect(sitemap().map((entry) => entry.url)).toEqual([
      `${ORIGIN}/`,
      `${ORIGIN}/de`,
      `${ORIGIN}/es`,
      `${ORIGIN}/fr`,
      `${ORIGIN}/docs/intro`,
      `${ORIGIN}/docs/english-only`,
      `${ORIGIN}/de/docs/intro`,
      `${ORIGIN}/es/docs/intro`,
      `${ORIGIN}/fr/docs/intro`,
    ]);
  });

  it("ranks the English root above the other roots and both above every docs page", () => {
    expect(sitemap().map((entry) => entry.priority)).toEqual([
      1, 0.9, 0.9, 0.9, 0.8, 0.8, 0.8, 0.8, 0.8,
    ]);
  });

  it("marks every entry as changing weekly", () => {
    expect(sitemap().every((entry) => entry.changeFrequency === "weekly")).toBe(true);
  });

  it("gives every locale root the same hreflang set, with no x-default", () => {
    for (const entry of sitemap().slice(0, 4)) {
      expect(entry.alternates).toEqual({ languages: HOME_LANGUAGES });
      expect(entry.alternates?.languages).not.toHaveProperty("x-default");
    }
  });

  it("cross-links a docs page to every locale it exists in", () => {
    const intro = sitemap().find((entry) => entry.url === `${ORIGIN}/docs/intro`);
    expect(intro?.alternates).toEqual({
      languages: {
        en: `${ORIGIN}/docs/intro`,
        de: `${ORIGIN}/de/docs/intro`,
        es: `${ORIGIN}/es/docs/intro`,
        fr: `${ORIGIN}/fr/docs/intro`,
      },
    });
  });

  it("omits the locales an untranslated docs page has no copy in", () => {
    const untranslated = sitemap().find((entry) => entry.url === `${ORIGIN}/docs/english-only`);
    expect(untranslated?.alternates).toEqual({
      languages: { en: `${ORIGIN}/docs/english-only` },
    });
  });
});
