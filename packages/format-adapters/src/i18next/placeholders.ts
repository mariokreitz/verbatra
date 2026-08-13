import { scanTokens } from "../shell.js";

const DOUBLE_BRACE_PATTERN = /\{\{[^{}]*\}\}/g;

const I18NEXT_PATTERN = /\{\{[^{}]*\}\}|\$t\([^()]*\)/g;

export function extractDoubleBracePlaceholders(value: string): readonly string[] {
  return scanTokens(value, DOUBLE_BRACE_PATTERN);
}

export function extractI18nextPlaceholders(value: string): readonly string[] {
  return scanTokens(value, I18NEXT_PATTERN);
}
