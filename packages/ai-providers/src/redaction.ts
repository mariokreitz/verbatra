const REDACTED = "[REDACTED]";

const KEY_PATTERNS: readonly RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{8,}/g,
  /AIza[0-9A-Za-z_-]{35}/g,
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?::fx)?/g,
];

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
