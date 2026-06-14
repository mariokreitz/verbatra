import { ProviderError } from "./errors.js";

/**
 * Read a required API key from the environment only. Keys are never read from
 * config, function arguments, or files. A missing or empty value yields a
 * structured error that names the variable but contains no key value.
 */
function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new ProviderError("MISSING_API_KEY", `The ${name} environment variable is not set.`);
  }
  return value;
}

/** The Anthropic API key, read only from ANTHROPIC_API_KEY. */
export function requireApiKey(): string {
  return readRequiredEnv("ANTHROPIC_API_KEY");
}

/** The OpenAI API key, read only from OPENAI_API_KEY. */
export function requireOpenAiKey(): string {
  return readRequiredEnv("OPENAI_API_KEY");
}

/** The Gemini API key, read only from GEMINI_API_KEY. */
export function requireGeminiKey(): string {
  return readRequiredEnv("GEMINI_API_KEY");
}
