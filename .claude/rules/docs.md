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
- `pnpm i18n` runs `verbatra translate` to regenerate translated content (see below).
- From the root, filter with `pnpm turbo run build --filter=@verbatra/docs`.

## Internationalization (the docs site dogfoods verbatra)

- Locales: `en` is the source of truth; `de`, `es`, and `fr` must be kept in step with
  it. The docs MUST stay current in every available language.
- UI strings live in `messages/<locale>.json` with `en.json` as the source. These are
  generated: edit `messages/en.json`, then run `pnpm i18n` (verbatra translate) to
  regenerate the locale files. Do not hand-edit the generated `messages/<locale>.json`.
- Doc pages use locale-suffixed MDX: `page.mdx` is the English source and
  `page.de.mdx`, `page.es.mdx`, `page.fr.mdx` are its translations. `pnpm i18n` does
  NOT translate these (verbatra translates JSON, XLIFF, YAML, and ARB, not Markdown),
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
- Only document features that exist. v1 CLI is `init`, `translate`, `watch`,
  `check`, `diff`, `export`, and `import`.
- Keep docs accurate to the current SDK and CLI surface. When a user-facing change
  lands (a CLI flag, a config key, an SDK export, provider or adapter behavior),
  update the matching page here.
- When you need Fumadocs framework guidance (frontmatter, MDX components, `meta.json`,
  i18n config), use the `read-fumadocs` skill to read the official Fumadocs docs
  rather than guessing.

## Scope

This is the docs-writer surface. Documentation changes belong here; do not push
product logic into the docs app, and do not change the SDK or CLI from this package.
