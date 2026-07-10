/**
 * Redaction backstop for everything the server sends to the client: every projected config string
 * and every mapped domain-error message passes through {@link redact} before leaving the process.
 * studio must never import from @verbatra/ai-providers (dependency direction), so the three key-shaped
 * patterns below are duplicated, not imported, from packages/ai-providers/src/redaction.ts; the
 * scrubbed environment variable names mirror packages/ai-providers/src/env.ts (PROVIDER_ENV plus the
 * openai-compatible convention variable, which lives outside PROVIDER_ENV; see that file's comment).
 * Keep both redaction files in sync when a provider's key shape or environment variable changes.
 */

const REDACTED = "[REDACTED]";

// Mirrors packages/ai-providers/src/redaction.ts KEY_PATTERNS exactly; each quantifier is over one
// character class to stay ReDoS-safe.
//
// Known gap: these three patterns match the four hosted providers' key shapes (OpenAI-style sk-,
// Gemini-style AIza, and DeepL's UUID-with-:fx form) plus Anthropic's key, which also matches sk-. They
// do not match an arbitrary local or self-hosted server token configured for openai-compatible (LM
// Studio, Ollama, and vLLM tokens have no fixed shape), so a real key set via OPENAI_COMPATIBLE_API_KEY
// or a custom apiKeyEnvVar is caught only by the exact-value scrub below, never by pattern. A fully
// general fix (redacting by an arbitrary configured apiKeyEnvVar name, not just the fixed list) is out
// of scope here; this comment exists so the gap is not silently missed.
const KEY_PATTERNS: readonly RegExp[] = [
  // The `\b` anchors `sk-` to a word start so hyphenated words like "risk-" or "task-" pass through.
  /\bsk-[A-Za-z0-9_-]{8,}/g,
  /AIza[0-9A-Za-z_-]{35}/g,
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?::fx)?/g,
];

// Mirrors packages/ai-providers/src/env.ts: the four hosted PROVIDER_ENV variables plus the
// openai-compatible convention variable OPENAI_COMPATIBLE_API_KEY (added alongside them here even
// though it is not part of PROVIDER_ENV itself, since it is exactly as real a key-bearing variable).
// studio never reads a key itself; this is a defense-in-depth exact-value scrub in case one leaked into
// a config string or an error message.
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
