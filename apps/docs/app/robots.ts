import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Allow full crawling and point crawlers at the sitemap on the canonical host.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: new URL("/sitemap.xml", SITE_URL).href,
    host: SITE_URL,
  };
}
