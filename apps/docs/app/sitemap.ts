import type { MetadataRoute } from "next";
import { i18n } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";
import { source } from "@/lib/source";

const HOME_ALTERNATES = {
  languages: {
    en: new URL("/", SITE_URL).href,
    de: new URL("/de", SITE_URL).href,
    es: new URL("/es", SITE_URL).href,
    fr: new URL("/fr", SITE_URL).href,
  },
} as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const homePaths: ReadonlyArray<{ path: string; priority: number }> = [
    { path: "/", priority: 1 },
    { path: "/de", priority: 0.9 },
    { path: "/es", priority: 0.9 },
    { path: "/fr", priority: 0.9 },
  ];
  const home: MetadataRoute.Sitemap = homePaths.map(({ path, priority }) => ({
    url: new URL(path, SITE_URL).href,
    changeFrequency: "weekly",
    priority,
    alternates: HOME_ALTERNATES,
  }));

  // Alternates rely on the i18n fallbackLanguage copy so every locale resolves and does not 404.
  const docs: MetadataRoute.Sitemap = i18n.languages.flatMap((locale) =>
    source.getPages(locale).map((page) => {
      const languages: Record<string, string> = {};
      for (const altLocale of i18n.languages) {
        const altPage = source.getPage(page.slugs, altLocale);
        if (altPage) languages[altLocale] = new URL(altPage.url, SITE_URL).href;
      }
      return {
        url: new URL(page.url, SITE_URL).href,
        changeFrequency: "weekly",
        priority: 0.8,
        alternates: { languages },
      };
    }),
  );

  return [...home, ...docs];
}
