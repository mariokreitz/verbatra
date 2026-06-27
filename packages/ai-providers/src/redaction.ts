const REDACTED = "[REDACTED]";

/**
 * Linear (ReDoS-safe) matchers for the four v1 provider key shapes. Each pattern anchors its
 * quantifier to a single character class with no nested or overlapping quantifiers, so matching
 * stays linear in input length and no catastrophic backtracking is possible.
 */
const KEY_PATTERNS: readonly RegExp[] = [
  // OpenAI (`sk-`, `sk-proj-`) and Anthropic (`sk-ant-`). The `\b` word boundary anchors the
  // match so `sk-` is only treated as a key prefix at a word start (string start, or after
  // whitespace or punctuation), not mid-word: ordinary words like "risk-", "task-", "desk-",
  // and "ask-" keep the preceding word character, so there is no boundary and they pass through.
  /\bsk-[A-Za-z0-9_-]{8,}/g,
  // Google / Gemini: `AIza` followed by 35 characters, 39 total.
  /AIza[0-9A-Za-z_-]{35}/g,
  // DeepL: an 8-4-4-4-12 hex UUID, with the optional `:fx` free-tier suffix.
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?::fx)?/g,
];

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replace anything that looks like a provider secret in a string with `[REDACTED]`: key-shaped
 * tokens for all four v1 providers (OpenAI / Anthropic `sk-`, Google / Gemini `AIza`, DeepL UUID
 * with optional `:fx`), and, when supplied, the exact configured secret value. Every pattern is
 * linear (ReDoS-safe). Returns the input unchanged when nothing matches.
 *
 * By-construction is the PRIMARY control and the actual guarantee that keeps keys out of provider
 * error text: `guardProviderCall` discards any caught SDK error and throws a static
 * {@link ProviderError}, and `env.ts` names the missing variable but never its value, so nothing
 * sensitive reaches a string in the first place. This function does NOT make provider errors safe;
 * construction does. It is wired into the {@link ProviderError} constructor as a defense-in-depth
 * backstop: every message is pattern-scrubbed so that any dynamic text a future contributor adds
 * to an error cannot carry a key shape. It does not weaken or replace the by-construction guarantee;
 * on the live paths, where every message is a constant, the scrub is a no-op.
 *
 * @param text - The text to scrub.
 * @param secret - An exact secret to also remove; defaults to `ANTHROPIC_API_KEY` from the
 *   environment. Pass an empty string to scrub by pattern only, independent of any single
 *   provider's environment variable.
 * @returns The text with key-shaped tokens and the configured secret replaced by `[REDACTED]`.
 */
export function redact(text: string, secret = process.env.ANTHROPIC_API_KEY): string {
  let out = text;
  for (const pattern of KEY_PATTERNS) {
    out = out.replace(pattern, REDACTED);
  }
  if (secret !== undefined && secret.length > 0) {
    out = out.replace(new RegExp(escapeForRegExp(secret), "g"), REDACTED);
  }
  return out;
}
