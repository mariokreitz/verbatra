import { scanTokens } from "../shell.js";

const PLACEHOLDER_PATTERN = /(?<!\{)\{\s*([A-Za-z_][\w$-]*|\d+)\s*\}(?!\})/g;

export function extractVueI18nPlaceholders(value: string): readonly string[] {
  return scanTokens(value, PLACEHOLDER_PATTERN, (match) => {
    const key = match[1];
    return key !== undefined ? `{${key}}` : undefined;
  });
}
