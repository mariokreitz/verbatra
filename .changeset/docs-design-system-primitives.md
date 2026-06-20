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
