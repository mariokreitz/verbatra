import { scanTokens } from "../shell.js";

const XLIFF_PATTERN = /<(?:x|g|bx|ex|ph|it|mrk)\b[^>]*>|\{[^{}]+\}/g;

export function extractXliffPlaceholders(value: string): readonly string[] {
  return scanTokens(value, XLIFF_PATTERN);
}
