import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { source } from "@/lib/source";

// Fumadocs does not emit a sitemap, so we build one explicitly: the homepage plus every
// documentation route, all on the canonical host. source.getPages() is the same page list
// the docs route renders, so the sitemap can never drift from what actually exists.
export default function sitemap(): MetadataRoute.Sitemap {
  const docs = source.getPages().map((page) => ({
    url: new URL(page.url, SITE_URL).href,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [
    {
      url: new URL("/", SITE_URL).href,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...docs,
  ];
}
