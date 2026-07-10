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

/**
 * The convention environment variable for the openai-compatible provider, read when config does not
 * name an `apiKeyEnvVar`. Deliberately not part of {@link PROVIDER_ENV}: every hosted provider has one
 * required variable, but openai-compatible has a three-tier fallback ending in a non-secret placeholder
 * (see {@link resolveOpenAiCompatibleKey}), so it does not fit that table and `init` scaffolding does
 * not offer it.
 */
export const OPENAI_COMPATIBLE_ENV_VAR = "OPENAI_COMPATIBLE_API_KEY";

/**
 * The literal, non-secret placeholder sent as the API key when no real key resolves. Local inference
 * servers usually require none; this is a fixed, publicly-known string, never derived from anything
 * sensitive, so it needs no redaction.
 */
export const OPENAI_COMPATIBLE_KEY_PLACEHOLDER = "local";

/**
 * Resolve the API key for the openai-compatible provider. Structurally isolated from every hosted
 * provider's key path: it never calls {@link readRequiredEnv} against a hosted variable, never reads
 * `OPENAI_API_KEY`, and shares no resolution function with {@link requireOpenAiKey}.
 *
 * Three-tier resolution:
 * 1. `customEnvVar` (the config's `apiKeyEnvVar`) is set: read that named variable. Throws
 *    `MISSING_API_KEY` if it is unset or empty, since the config author explicitly asserted a real key
 *    is required there; silently falling back would be a quieter failure than intended.
 * 2. `customEnvVar` is absent: read the convention variable `OPENAI_COMPATIBLE_API_KEY`. If set and
 *    non-empty, use it.
 * 3. Both absent: fall back to {@link OPENAI_COMPATIBLE_KEY_PLACEHOLDER}, `"local"`.
 *
 * Residual risk (documented here and in the provider docs, not enforced at runtime): when tier 1 or 2
 * resolves a real key and the provider's `baseUrl` is plaintext `http:` to a non-loopback host, that key
 * travels over the network in cleartext. v1 allows this combination; see the openai-compatible provider
 * docs for the full rationale.
 *
 * @param customEnvVar - The config's optional `apiKeyEnvVar`, naming which variable to read a real key
 *   from. When omitted, the convention variable is read instead.
 * @returns The resolved key value, or the `"local"` placeholder.
 * @throws {@link ProviderError} `MISSING_API_KEY`: `customEnvVar` was given but is unset or empty.
 */
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
