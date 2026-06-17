import { resolve } from "node:path";

/** The token in a files pattern that is replaced by the locale. */
export const LOCALE_TOKEN = "{locale}";

/**
 * Resolve the file path for one locale from the configured pattern. The pattern carries
 * a {locale} token; the result is resolved against the working directory. This is the
 * SDK's only path convention. It adds no format knowledge.
 */
export function localeFilePath(cwd: string, pattern: string, locale: string): string {
  return resolve(cwd, pattern.replaceAll(LOCALE_TOKEN, locale));
}
