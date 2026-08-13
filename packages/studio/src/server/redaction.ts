const REDACTED = "[REDACTED]";

const KEY_PATTERNS: readonly RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{8,}/g,
  /AIza[0-9A-Za-z_-]{35}/g,
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?::fx)?/g,
];

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

export function redact(text: string): string {
  let out = text;
  for (const pattern of KEY_PATTERNS) {
    out = out.replace(pattern, REDACTED);
  }
  return scrubConfiguredEnvValues(out);
}
