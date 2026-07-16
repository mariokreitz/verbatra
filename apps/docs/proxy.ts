import { createI18nMiddleware } from "fumadocs-core/i18n/middleware";
import { i18n } from "@/lib/i18n";

/** Locale-routing middleware from the Fumadocs i18n config. */
export default createI18nMiddleware(i18n);

/** Middleware matcher excluding API routes, Next internals, and static files. */
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|llms.txt|llms-full.txt|.*\\.(?:png|ico|svg|webmanifest)$).*)",
  ],
};
