const REDACTED = "[REDACTED]";

/**
 * Linear (ReDoS-safe) match for API-key-shaped tokens. Anthropic keys start
 * with `sk-ant-`; the broader `sk-` prefix also catches OpenAI-style keys so a
 * future provider's key cannot slip through the same path. The character class
 * has no overlapping quantifiers, so matching is linear in input length.
 */
const KEY_LIKE = /sk-[A-Za-z0-9_-]{8,}/g;

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replace anything that looks like a secret in a string with `[REDACTED]`: `sk-`-prefixed key-shaped
 * tokens (Anthropic `sk-ant-` and the broader `sk-` family), and — when supplied — the exact configured
 * secret value. The match is linear (ReDoS-safe). Returns the input unchanged when nothing matches.
 *
 * This is a standalone utility, NOT the active error path. Provider errors are secret-free BY
 * CONSTRUCTION: the providers never bind or embed raw SDK error text in a thrown error in the first
 * place — the unbound catch in `guardProviderCall` throws a static {@link ProviderError}. By-construction
 * is the stronger guarantee; nothing sensitive reaches a string that would need scrubbing. Do not
 * describe provider errors as "redacted via `redact`": no provider routes through this. Use it only for
 * an explicit, separate sink (for example, scrubbing free-form text before a debug log).
 *
 * @param text - The text to scrub.
 * @param secret - An exact secret to also remove; defaults to `ANTHROPIC_API_KEY` from the environment.
 * @returns The text with key-shaped tokens and the configured secret replaced by `[REDACTED]`.
 */
export function redact(text: string, secret = process.env.ANTHROPIC_API_KEY): string {
  let out = text.replace(KEY_LIKE, REDACTED);
  if (secret !== undefined && secret.length > 0) {
    out = out.replace(new RegExp(escapeForRegExp(secret), "g"), REDACTED);
  }
  return out;
}
