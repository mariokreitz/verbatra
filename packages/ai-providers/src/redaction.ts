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
 * Remove anything that looks like a secret from a string before it is logged,
 * thrown, or surfaced. Replaces key-shaped tokens and, when supplied, the exact
 * known secret value (defaults to the Anthropic key from the environment). This
 * is the single redaction path every provider must route error/log text through.
 */
export function redact(text: string, secret = process.env.ANTHROPIC_API_KEY): string {
  let out = text.replace(KEY_LIKE, REDACTED);
  if (secret !== undefined && secret.length > 0) {
    out = out.replace(new RegExp(escapeForRegExp(secret), "g"), REDACTED);
  }
  return out;
}
