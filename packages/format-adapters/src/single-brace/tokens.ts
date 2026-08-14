import { scanTokens } from "../shell.js";

const SINGLE_BRACE_PATTERN = /(?<!\{)\{\s*([A-Za-z_][\w$-]*|\d+)\s*\}(?!\})/g;

export function extractSingleBraceTokens(value: string): readonly string[] {
  return scanTokens(value, SINGLE_BRACE_PATTERN, (match) => {
    const key = match[1];
    return key !== undefined ? `{${key}}` : undefined;
  });
}
