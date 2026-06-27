const REDACTED = "[REDACTED]";

/** Matchers for the four v1 provider key shapes; each quantifier is over one class to stay ReDoS-safe. */
const KEY_PATTERNS: readonly RegExp[] = [
  // The `\b` anchors `sk-` to a word start so hyphenated words like "risk-" or "task-" pass through.
  /\bsk-[A-Za-z0-9_-]{8,}/g,
  /AIza[0-9A-Za-z_-]{35}/g,
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?::fx)?/g,
];

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replace anything that looks like a provider secret with `[REDACTED]`: key-shaped tokens for all
 * four v1 providers and, when supplied, the exact configured secret value. Returns the input
 * unchanged when nothing matches. This is a defense-in-depth backstop, not the primary control:
 * provider errors are secret-free by construction (the guard and `env.ts` keep keys out of error text).
 *
 * @param text - The text to scrub.
 * @param secret - An exact secret to also remove; defaults to `ANTHROPIC_API_KEY` from the
 *   environment. Pass an empty string to scrub by pattern only.
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
