---
name: read-fumadocs
description: >-
  Retrieve clean, accurate content from a documentation site built with Fumadocs
  by using its machine-readable endpoints (llms.txt, per-page Markdown, and the
  search API) instead of scraping rendered HTML. Use when you need to read a
  Fumadocs site (for example the official Fumadocs docs while working on apps/docs)
  to get authoring conventions, component usage, or config right. This reads
  external Fumadocs sites; it does not author or build the verbatra docs itself.
---

# read-fumadocs

A locally authored equivalent of the (now delisted) `fuma-nama/fumadocs@read-docs`
skill. It uses the standard Fumadocs machine-readable surfaces so an agent reads
processed Markdown rather than parsing rendered HTML.

## When to use

- You need to look up how Fumadocs does something (frontmatter, MDX components,
  `meta.json`, i18n, search config) before editing `apps/docs`.
- You want clean Markdown from any Fumadocs-powered site for reference.

This is a consumption skill. It does not write, build, or deploy the verbatra docs.
For that, use the `docs` skill and the docs-writer agent.

## How Fumadocs exposes content

These endpoints are conventions a Fumadocs site opts into. Exact paths depend on the
target site's configuration, so confirm against its `/llms.txt` first.

1. Route index: fetch `<site>/llms.txt` for a curated list of documentation routes,
   and `<site>/llms-full.txt` when the site publishes the full corpus in one file.
2. Per-page Markdown: many sites serve processed Markdown for a page by appending
   `.md` to its route, or via an `llms.mdx` route such as
   `<site>/llms.mdx/<path>/content.md`. Prefer this over the HTML page.
3. Search: query the JSON search endpoint at `<site>/api/search?query=<terms>` to
   locate the right page before fetching its Markdown.

## Procedure

1. Fetch `/llms.txt` (or `/llms-full.txt`) to discover available routes.
2. If the route is not obvious, hit `/api/search?query=...` to find it.
3. Fetch the page's Markdown form (the `.md` or `llms.mdx` variant), not the HTML.
4. If none of these endpoints exist on the target site, fall back to the rendered
   page and say so, since the site has not enabled the llms.txt surface.

## Notes

- Treat retrieved content as reference only. Do not copy text wholesale into the
  verbatra docs; follow the repository language and style rules in CLAUDE.md.
- The canonical Fumadocs documentation site is a good default target when you need
  framework guidance for `apps/docs`.
