---
paths:
  - "apps/docs/**"
---

# apps/docs rules (Fumadocs documentation site)

`apps/docs` (`@verbatra/docs`, private) is the user-facing documentation site, built
with Fumadocs on Next.js. These rules are binding when editing anything under
`apps/docs`. They sit on top of the repository rules in the root CLAUDE.md, not
instead of them.

## What it is

- Fumadocs (Next.js App Router). Content is MDX under `content/docs`, configured by
  `source.config.ts` via `fumadocs-mdx` (`defineDocs({ dir: "content/docs" })`).
- `postinstall` runs `fumadocs-mdx`, which generates the `.source/` directory. That
  directory and `verbatra.lock.json` are generated output: never hand-edit them.
- Navigation and ordering come from Fumadocs `meta.json` files in `content/docs`, not
  from manual link lists.

## Commands

Run inside `apps/docs` (or with a turbo filter from the root):

- `pnpm dev` (next dev), `pnpm build` (next build), `pnpm start` (next start).
- `pnpm typecheck` (tsc --noEmit). Run it after edits to `app`, `lib`, `components`,
  or config.
- `pnpm test` (vitest run). This app has its own test suite; run it after changing
  anything under `lib` or `components`.
- `pnpm i18n` runs `verbatra translate` to regenerate translated content (see below).
- From the root, filter with `pnpm turbo run build --filter=@verbatra/docs`.

## Internationalization (the docs site dogfoods verbatra)

- Locales: `en` is the source of truth; `de`, `es`, and `fr` must be kept in step with
  it. The docs MUST stay current in every available language.
- UI strings live in `messages/<locale>.json` with `en.json` as the source. Which
  repair is correct depends on which side is wrong, because `verbatra.lock.json`
  records only a hash of the English entry: a key is classified stale purely by
  comparing that hash, and only missing and stale keys are ever sent to the provider.
- The English source changed, or the key is new: edit `messages/en.json`, then run
  `pnpm i18n` (verbatra translate) to regenerate the locale files.
- The English source is already right and only a translation is wrong: `pnpm i18n`
  regenerates nothing, because the key still hashes to its recorded baseline and
  counts as up to date. Fix it with a Studio edit (`pnpm studio`; local editing needs
  no provider and no `--allow-spend`) or with a workbook round trip
  (`verbatra export --include-unchanged`, correct the row, then `verbatra import`;
  the flag is required because an up-to-date key is not exported by default). Both
  routes write the corrected value, hold it to the placeholder and ICU integrity gate,
  advance the lock entry, and record the text in the translation memory. The same
  mechanism explains why pinning a glossary term on its own retranslates nothing: the
  glossary is not part of the content hash.
- Do not hand-edit the generated `messages/<locale>.json`. With the source unchanged
  it leaves the same lock state behind, so it looks equivalent, but it skips the
  integrity gate and leaves the translation memory holding the superseded text.
- Doc pages use locale-suffixed MDX: `page.mdx` is the English source and
  `page.de.mdx`, `page.es.mdx`, `page.fr.mdx` are its translations. `pnpm i18n` does
  NOT translate these (verbatra translates JSON, XLIFF, YAML, ARB, and properties, not
  Markdown),
  so the docs team maintains them by hand: whenever you change or add an English
  `.mdx`, update or create its translation for every locale in the same change.
- When translating a page, translate the prose and the frontmatter `title` and
  `description` values only; keep code blocks, inline code, CLI flags, file paths,
  URLs, JSON keys and values, MDX component names, and frontmatter keys verbatim; keep
  the glossary terms from `apps/docs/verbatra.config.ts` untranslated; never use the em
  dash.
- Register: the audience is developers and users, so write a direct, technical, concise
  tone with informal personal address in every language: German `du` (never `Sie` or
  `Ihr` forms), Spanish `tú` (never `usted`), French `tu` (never `vous`). Prefer active
  voice and imperatives over impersonal or passive phrasing.

## Authoring rules

- English source content only, and apply the root language and style rules: no emojis,
  no decorative formatting, and never the em dash (U+2014). Use a spaced hyphen, a
  colon, or parentheses.
- Only document features that exist, and read the shipped surface from the code rather
  than from any list in a guidance file, this one included. The CLI commands are the
  `.command(...)` registrations in `packages/cli/src/run.ts`, the formats are the
  adapters `createDefaultRegistry` registers in `@verbatra/format-adapters`, and the
  providers are the factory table in `packages/sdk/src/config/provider-config.ts`. An
  enumeration written into guidance goes stale the day a command ships; those three
  files cannot. This rule replaced such an enumeration twice, in the same place.
- When a command is added, sweep the periphery too (the get-started walkthrough, the
  FAQ, the troubleshooting entries, the landing FAQ in `messages/*.json`, and the SDK
  page's entry-point list), not just its own `cli/` page.
- Keep docs accurate to the current SDK and CLI surface. When a user-facing change
  lands (a CLI flag, a config key, an SDK export, provider or adapter behavior),
  update the matching page here.

### The "available from" callout

Docs deploy on every merge, while npm publishes only at release time. Between the two
a page can describe behavior that is on `main` but that no reader can install yet.
Mark those pages so the gap is visible instead of silent.

- Use `<AvailableFrom version="0.9.0" />` on its own line, with a blank line either
  side. It renders a Fumadocs `Callout` and is registered in
  `apps/docs/components/mdx.tsx`, so no import is needed.
- Place it directly after the frontmatter when the whole page is new, and directly
  above the heading or paragraph that introduces the behavior when only part of a page
  is version-gated. Mark the section that introduces the behavior, not every sentence
  that mentions it.
- The `version` is the version of the package that ships the behavior. The default copy
  names verbatra, so a bare `version` means the CLI and SDK. For anything that ships in
  a different package, pass `pkg` as well:
  `<AvailableFrom version="0.4.0" pkg="@verbatra/studio" />`. That switches the callout
  to the package-qualified wording; without it the callout would tell a reader to check
  `verbatra --version`, which answers for the wrong package.
- Use it when a page (or a section you are adding to one) documents behavior that has
  merged but is not yet published, and for behavior that is published but needs a
  minimum version. The two cases share one wording, so no distinction is needed at the
  call site.
- The `version` is the release the behavior ships in. Get it from
  `pnpm changeset status`, which reports the bump the pending changesets produce; do
  not work it out by hand.
- The copy lives in `apps/docs/messages/en.json` under `docs.availableFrom` and is
  translated by `pnpm i18n` like every other UI string, so the same MDX line goes into
  the `.de.mdx`, `.es.mdx`, and `.fr.mdx` siblings unchanged.
- The wording stays true after the release ships, so nothing has to be removed on
  release day. Dropping the callout once the version is a few releases old is
  housekeeping, not a required step.
- When you need Fumadocs framework guidance (frontmatter, MDX components, `meta.json`,
  i18n config), use the `read-fumadocs` skill to read the official Fumadocs docs
  rather than guessing.

## Scope

This is the docs-writer surface. Documentation changes belong here; do not push
product logic into the docs app, and do not change the SDK or CLI from this package.
