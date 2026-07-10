import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

// Matches the hairline underline-on-hover treatment used by the landing footer's link list, so
// the two styles read as one system rather than two.
const LINK_CLASS =
  "underline decoration-transparent underline-offset-4 transition-colors hover:text-fd-foreground hover:decoration-[color:color-mix(in_srgb,var(--v-glow)_45%,transparent)]";

// A small, persistent pair of links pinned to the docs sidebar footer, so /llms.txt and
// /llms-full.txt stay reachable on every /docs/* page, not only from the home page footer. Both
// routes are site-root, English-only, and unprefixed regardless of the active locale (see
// app/llms.txt/route.ts), so the hrefs below are deliberately not run through the locale prefix
// helper in lib/layout.shared.tsx.
export async function DocsSidebarLlmsLinks(): Promise<ReactNode> {
  const t = await getTranslations("docs.llms");
  return (
    <div className="flex flex-col gap-1.5 border-t border-fd-border pt-3 text-xs text-fd-muted-foreground">
      {/* The <p> picks up the sidebar's group-label treatment (font-mono, lowercase, tracked)
          from the #nd-sidebar p rule in global.css, so it reads as another section label rather
          than a new visual element. */}
      <p>{t("heading")}</p>
      <a href="/llms.txt" className={LINK_CLASS}>
        {t("index")}
      </a>
      <a href="/llms-full.txt" className={LINK_CLASS}>
        {t("full")}
      </a>
    </div>
  );
}
