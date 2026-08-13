import { ProviderError } from "./errors.js";

export const PROVIDER_ENV = {
  /** Environment variable holding the Anthropic API key. */
  anthropic: "ANTHROPIC_API_KEY",
  /** Environment variable holding the OpenAI API key. */
  openai: "OPENAI_API_KEY",
  /** Environment variable holding the Gemini API key. */
  gemini: "GEMINI_API_KEY",
  /** Environment variable holding the DeepL API key. */
  deepl: "DEEPL_API_KEY",
} as const;

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new ProviderError("MISSING_API_KEY", `The ${name} environment variable is not set.`);
  }
  return value;
}

export function requireAnthropicKey(): string {
  return readRequiredEnv(PROVIDER_ENV.anthropic);
}

export function requireOpenAiKey(): string {
  return readRequiredEnv(PROVIDER_ENV.openai);
}

export function requireGeminiKey(): string {
  return readRequiredEnv(PROVIDER_ENV.gemini);
}

export function requireDeepLKey(): string {
  return readRequiredEnv(PROVIDER_ENV.deepl);
}

export const OPENAI_COMPATIBLE_ENV_VAR = "OPENAI_COMPATIBLE_API_KEY";

export const OPENAI_COMPATIBLE_KEY_PLACEHOLDER = "local";

export function resolveOpenAiCompatibleKey(customEnvVar?: string): string {
  const varName = customEnvVar ?? OPENAI_COMPATIBLE_ENV_VAR;
  const value = process.env[varName];
  if (value !== undefined && value.length > 0) {
    return value;
  }
  if (customEnvVar !== undefined) {
    throw new ProviderError(
      "MISSING_API_KEY",
      `The ${customEnvVar} environment variable is not set.`,
    );
  }
  return OPENAI_COMPATIBLE_KEY_PLACEHOLDER;
}
