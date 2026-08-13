const RTL_LANGUAGE_SUBTAGS: ReadonlySet<string> = new Set(["ar", "he", "fa", "ur"]);

function primarySubtag(locale: string): string {
  return (locale.split(/[-_]/)[0] ?? "").toLowerCase();
}

export function isRtlLocale(locale: string): boolean {
  return RTL_LANGUAGE_SUBTAGS.has(primarySubtag(locale));
}
