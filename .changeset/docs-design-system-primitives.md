---
"@verbatra/docs": minor
---

Formalize the Verbatra Design System in the docs app: add the theme-agnostic DS scale tokens
(type, spacing, radii, shadows, glows, washes, motion) and semantic aliases mapped onto the
existing Fumadocs `--color-fd-*` tokens in `global.css`, and introduce a `components/ui/`
primitive set — `Button`, `Badge`, `Card`, `CommandLine`, `Input`, and `Tabs`. `Button`,
`Badge`, `Card`, and `Input` are server components; `CommandLine` (clipboard) and `Tabs`
(selection) are the only client boundaries. The landing CTAs and hero install line now use the
new primitives, the legacy `.v-cta` rule and `CopyCommand` are removed, and MDX registers
`Badge`, `Card`, `CommandLine`, and the DS tabs under `VTabs` (to avoid colliding with the
Fumadocs built-in `Tabs`). This is a formalization of the existing visuals, not a redesign; the
site looks unchanged in both light and dark.

Rebuild the marketing home page (`app/(home)/page.tsx`) into the full Design System landing,
built on the new primitives: hero with the package-manager install switcher and Globe, a trust
strip, an infinite-scrolling compatibility marquee (two full-bleed bands of framework and
provider chips, with masked edges, hover-pause, and a reduced-motion fallback), the run
showcase, a how-it-works pipeline, a why-verbatra grid, a single-open FAQ accordion, a closing
terminal mock with CTA, and a full four-column footer. The marquee keyframes and full-bleed band
styles are added to `global.css` (with `overflow-x: clip` guarding the `100vw` bleed). The
on-page FAQ now has six Q&As, sourced once from `lib/structured-data` so the visible accordion
and the FAQPage JSON-LD stay in sync.

Refine the landing and add legal pages: give the package-manager install switcher a stable width
so it no longer jumps as you change manager; cap the compatibility marquee at a centered 1600px
(removing the `100vw` full-bleed) and repeat the provider chips so the right-scrolling band loops
seamlessly without revealing empty space on wide displays; render monochrome brand icons in the
marquee chips (via `@icons-pack/react-simple-icons`, plus an inlined OpenAI logomark since Simple
Icons does not ship it, and a glow-dot fallback for the library/format chips that have no brand
mark); and add an npm link beside the GitHub link in the footer brand column.
Wire up self-hosted, cookieless Umami analytics (no consent banner) in the root layout, and add a
`(legal)` route group with `/privacy` (GDPR privacy policy reflecting the real, analytics-light,
cookieless deployment) and `/imprint` (German DDG/MStV Impressum), linked from the footer Legal
column.

Localize the landing page and make the docs app dark-mode-only, app-wide. i18n uses a hybrid:
Fumadocs i18n owns routing, the middleware (`proxy.ts`), and the `[lang]` segment
(`defaultLanguage: "en"`, `languages: en/de/es/fr`, `hideLocale: "default-locale"`,
`fallbackLanguage: "en"`), while next-intl owns the message catalog (next-intl namespaced JSON,
source at `messages/en.json`; `de`/`es`/`fr` seeded as English fallbacks until translated). The
whole localizable tree moves under `app/[lang]/` (home, legal, docs); route handlers
(`api/search`, `sitemap`, `robots`, `llms.txt`, icons, `global.css`) stay outside it, and the
middleware matcher excludes `api`, `_next`, `favicon.ico`, `robots.txt`, `sitemap.xml`,
`llms.txt`, and image assets so those routes are never locale-redirected. English stays at `/`
(no `/en`); `/de`, `/es`, `/fr` are prefixed, with Accept-Language auto-detect on first visit.
Every user-visible landing string is externalized to the `landing.*` catalog and read via
next-intl (`useTranslations` / `getTranslations`); the FAQ items are read once on the server and
fed to both the visible accordion and the FAQPage JSON-LD so the two never drift, and JSON-LD
`inLanguage` plus `softwareApplicationLd().description` follow the active locale. `generateMetadata`
emits per-locale description/OG and `alternates.languages` hreflang (en/de/es/fr + `x-default`),
and the sitemap adds the per-locale home routes (docs stays English-only pending the deferred docs
i18n). A compact locale switcher (lowercase `en`/`de`/`es`/`fr` codes, autonym accessible names,
the VMARK glyph, glow active-bar, keyboard + focus-visible) is injected into the shared nav as a
single client leaf via the `BaseLayoutProps` custom slot; every option is a real `<a href>` that
works without JS and is crawlable. Terminal-mock output and brand/proper-noun terms are kept
English per the inventory. Dark-mode-only: the audited dark `--color-fd-*` values are promoted to
the unconditional `:root` default, the light `:root` block and the `:root:not(.dark)` prose-link
override are removed, `RootProvider` forces dark (`theme={{ enabled: false }}`), the Fumadocs
theme switch is disabled (`themeSwitch: { enabled: false }`), and `<html className="dark">` is
server-rendered so first paint is dark with no flash-of-light.

Scaffold verbatra dogfooding the docs catalog (NOT yet run): `apps/docs/verbatra.config.ts`
declares source `en`, targets `de`/`es`/`fr`, format `next-intl-json`, the Gemini provider (API
key read from `GEMINI_API_KEY` env only — never in the config), `messages/{locale}.json` files,
and a brand-term glossary. A `pnpm i18n` script runs `verbatra translate`, with `@verbatra/cli`
and `@verbatra/sdk` added as devDependencies. The translation run is pending a free Gemini API
key; until then the `de`/`es`/`fr` catalogs ship as English-fallback seeds and `pnpm i18n` is the
dogfooding step that fills them.
