import type { DiffLocale } from "./diff-view.js";

function formatKeyLine(title: string, keys: readonly string[]): string {
  const names = keys.length === 0 ? "(none)" : keys.join(", ");
  return `- ${title} (${keys.length}): ${names}`;
}

function formatLocaleSection(locale: DiffLocale): string {
  return [
    `## ${locale.locale}`,
    formatKeyLine("Missing", locale.missing),
    formatKeyLine("Changed", locale.changed),
    formatKeyLine("Orphaned", locale.orphaned),
  ].join("\n");
}

/**
 * Renders the full, uncapped diff data for every currently loaded locale as a Markdown summary
 * suitable for pasting into a pull request description or a chat message: per locale, the
 * missing, changed, and orphaned key counts and key names. Always reflects every key in
 * `locales`, never the on-screen view, which is client-side filtered and capped at
 * `filter.ts`'s `MAX_RENDERED_KEYS`; the caller must pass the Diff panel's raw loaded result, not
 * that filtered or capped view, or the report would misrepresent the actual diff.
 *
 * The fixed template text this function writes (headings, labels, punctuation) never contains an
 * em dash, matching this repository's writing rules. Key and locale names are opaque data from
 * the project being diffed and are rendered verbatim; this function does not alter or validate
 * their content.
 */
export function buildReviewReportMarkdown(locales: readonly DiffLocale[]): string {
  const header = "# Translation diff review report";
  if (locales.length === 0) {
    return `${header}\n\nNo locales are currently loaded.`;
  }
  return [header, ...locales.map(formatLocaleSection)].join("\n\n");
}
