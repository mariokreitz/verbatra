/**
 * Redaction backstop for everything the server sends to the client: every projected config string
 * and every mapped domain-error message passes through {@link redact} before leaving the process.
 * ui must never import from @verbatra/ai-providers (dependency direction), so the three key-shaped
 * patterns below are duplicated, not imported, from packages/ai-providers/src/redaction.ts; the
 * four scrubbed environment variable names mirror packages/ai-providers/src/env.ts (PROVIDER_ENV).
 * Keep both redaction files in sync when a provider's key shape or environment variable changes.
 */

const REDACTED = "[REDACTED]";

// Mirrors packages/ai-providers/src/redaction.ts KEY_PATTERNS exactly; each quantifier is over one
// character class to stay ReDoS-safe.
const KEY_PATTERNS: readonly RegExp[] = [
  // The `\b` anchors `sk-` to a word start so hyphenated words like "risk-" or "task-" pass through.
  /\bsk-[A-Za-z0-9_-]{8,}/g,
  /AIza[0-9A-Za-z_-]{35}/g,
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?::fx)?/g,
];

// Mirrors packages/ai-providers/src/env.ts PROVIDER_ENV: the four environment variables a provider
// reads its API key from. ui never reads a key itself; this is a defense-in-depth exact-value scrub
// in case one leaked into a config string or an error message.
const PROVIDER_ENV_VAR_NAMES = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "DEEPL_API_KEY",
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
 * Replaces anything that looks like a provider secret with `[REDACTED]`: the three key-shaped
 * patterns above, plus the exact value of any of the four provider API key environment variables
 * that happen to be set. Returns the input unchanged when nothing matches.
 */
export function redact(text: string): string {
  let out = text;
  for (const pattern of KEY_PATTERNS) {
    out = out.replace(pattern, REDACTED);
  }
  return scrubConfiguredEnvValues(out);
}
