import { loader } from "fumadocs-core/source";
import { docs } from "@/.source/server";
import { i18n } from "@/lib/i18n";

// The content tree lives at apps/docs/content/docs (committed in WS6). meta.json there
// drives the sidebar order; this loader exposes it to the layout and the page route.
//
// The loader is i18n-aware so `getPageTree(lang)` / `getPage(slug, lang)` work under the
// `[lang]` segment. The MDX content itself is English-only for now (docs content i18n is
// deferred); with `fallbackLanguage: "en"`, every locale resolves to the English pages until
// translated MDX (e.g. `index.de.mdx`) is added — no routing rework needed then.
export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
  i18n,
});
