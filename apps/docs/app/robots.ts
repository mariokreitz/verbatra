import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** The robots.txt rules: allow everything and point at the sitemap. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: new URL("/sitemap.xml", SITE_URL).href,
    host: SITE_URL,
  };
}
