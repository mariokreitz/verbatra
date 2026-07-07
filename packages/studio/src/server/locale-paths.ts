import { resolve } from "node:path";

const LOCALE_TOKEN = "{locale}";

/** Resolves the file path for one locale from the configured `{locale}` pattern, against cwd. */
export function localeFilePath(cwd: string, pattern: string, locale: string): string {
  return resolve(cwd, pattern.replaceAll(LOCALE_TOKEN, locale));
}
