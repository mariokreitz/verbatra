import { ProviderError } from "./errors.js";

/**
 * Read the Anthropic API key from the environment only. It is never read from
 * config, function arguments, or files. A missing or empty key yields a structured
 * error whose message contains no key value.
 */
export function requireApiKey(): string {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey === undefined || apiKey.length === 0) {
    throw new ProviderError(
      "MISSING_API_KEY",
      "The ANTHROPIC_API_KEY environment variable is not set.",
    );
  }
  return apiKey;
}
