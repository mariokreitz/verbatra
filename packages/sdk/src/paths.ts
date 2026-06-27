import { resolve } from "node:path";

/** The token in a files pattern that is replaced by the locale. */
export const LOCALE_TOKEN = "{locale}";

/** Resolve the file path for one locale from the configured `{locale}` pattern, against cwd. */
export function localeFilePath(cwd: string, pattern: string, locale: string): string {
  return resolve(cwd, pattern.replaceAll(LOCALE_TOKEN, locale));
}
