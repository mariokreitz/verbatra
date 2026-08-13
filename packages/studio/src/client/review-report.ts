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

export function buildReviewReportMarkdown(locales: readonly DiffLocale[]): string {
  const header = "# Translation diff review report";
  if (locales.length === 0) {
    return `${header}\n\nNo locales are currently loaded.`;
  }
  return [header, ...locales.map(formatLocaleSection)].join("\n\n");
}
