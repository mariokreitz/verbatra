import { ProviderError } from "./errors.js";

/** Provider id to the environment variable its API key is read from; the single source of each name. */
export const PROVIDER_ENV = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  gemini: "GEMINI_API_KEY",
  deepl: "DEEPL_API_KEY",
} as const;

/**
 * Read a required API key from the environment only, never from config, arguments, or files.
 *
 * @param name - The environment variable to read.
 * @returns The non-empty value.
 * @throws {@link ProviderError} `MISSING_API_KEY`: the variable is unset or empty; the message names the
 *   variable but never includes a key value.
 */
function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new ProviderError("MISSING_API_KEY", `The ${name} environment variable is not set.`);
  }
  return value;
}

/** The Anthropic API key, read only from ANTHROPIC_API_KEY. */
export function requireAnthropicKey(): string {
  return readRequiredEnv(PROVIDER_ENV.anthropic);
}

/** The OpenAI API key, read only from OPENAI_API_KEY. */
export function requireOpenAiKey(): string {
  return readRequiredEnv(PROVIDER_ENV.openai);
}

/** The Gemini API key, read only from GEMINI_API_KEY. */
export function requireGeminiKey(): string {
  return readRequiredEnv(PROVIDER_ENV.gemini);
}

/** The DeepL API key, read only from DEEPL_API_KEY. */
export function requireDeepLKey(): string {
  return readRequiredEnv(PROVIDER_ENV.deepl);
}
