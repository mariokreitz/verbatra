const REDACTED = "[REDACTED]";

/**
 * Key-shaped patterns, mirroring packages/ai-providers/src/redaction.ts KEY_PATTERNS exactly.
 * studio must never import from @verbatra/ai-providers (dependency direction), so the patterns
 * are duplicated, not imported; keep both files in sync when a provider's key shape changes.
 * Each quantifier runs over a single character class to stay ReDoS-safe, and the `\b` anchors
 * `sk-` to a word start so hyphenated words like "risk-" pass through.
 *
 * Known gap: these patterns cover the hosted providers' key shapes (OpenAI-style `sk-`, which
 * also matches Anthropic keys, Gemini-style `AIza`, and DeepL's UUID-with-`:fx` form). An
 * arbitrary local or self-hosted token configured for openai-compatible has no fixed shape, so a
 * real key set via OPENAI_COMPATIBLE_API_KEY or a custom apiKeyEnvVar is caught only by the
 * exact-value scrub below, never by pattern.
 */
const KEY_PATTERNS: readonly RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{8,}/g,
  /AIza[0-9A-Za-z_-]{35}/g,
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?::fx)?/g,
];

/**
 * The key-bearing environment variable names whose exact values are scrubbed: the four hosted
 * provider variables from packages/ai-providers/src/env.ts plus the openai-compatible convention
 * variable. studio never reads a key for its own use; this is a defense-in-depth scrub in case a
 * key value leaked into a config string or an error message. Keep in sync with that env module.
 */
const PROVIDER_ENV_VAR_NAMES = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "DEEPL_API_KEY",
  "OPENAI_COMPATIBLE_API_KEY",
] as const;

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scrubConfiguredEnvValues(text: string): string {
  let out = text;
  for (const name of PROVIDER_ENV_VAR_NAMES) {
    const value = process.env[name];
    if (value !== undefined && value.length > 0) {
      out = out.replace(new RegExp(escapeForRegExp(value), "g"), REDACTED);
    }
  }
  return out;
}

/**
 * Replaces anything that looks like a provider secret with `[REDACTED]`: the key-shaped patterns
 * above, plus the exact value of any of the five provider API key environment variables that
 * happen to be set. Returns the input unchanged when nothing matches. This is the redaction
 * backstop for everything the server sends to a client; every projected config string and every
 * mapped domain-error message passes through it before leaving the process.
 */
export function redact(text: string): string {
  let out = text;
  for (const pattern of KEY_PATTERNS) {
    out = out.replace(pattern, REDACTED);
  }
  return scrubConfiguredEnvValues(out);
}
