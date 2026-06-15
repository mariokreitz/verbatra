/**
 * Map a standard JSON Schema type keyword to Google's Schema Type enum (uppercase).
 * Gemini's responseSchema dialect uses UPPERCASE type names and has no
 * additionalProperties concept, so the canonical derivation must be transformed.
 *
 * responseSchema (Google dialect) is used over responseJsonSchema (raw JSON Schema,
 * typed `unknown`) so the request boundary stays type-checked.
 */
const TYPE_MAP: Record<string, string> = {
  string: "STRING",
  number: "NUMBER",
  integer: "INTEGER",
  boolean: "BOOLEAN",
  array: "ARRAY",
  object: "OBJECT",
};

/**
 * Keywords the transform recognizes: either intentionally transformed/recursed, or
 * intentionally dropped because Google's Schema dialect rejects them. Any keyword
 * NOT in this set is unsupported and throws, so a future addition to the canonical
 * schema (enum, format, nullable, minItems, ...) surfaces loudly instead of being
 * silently dropped and weakening the model-side constraint. The accompanying test
 * (gemini/schema.test.ts) documents this supported subset.
 */
const HANDLED_KEYWORDS = new Set([
  // transformed or recursed
  "type",
  "required",
  "properties",
  "items",
  // deliberately dropped (not part of Google's Schema dialect)
  "$schema",
  "additionalProperties",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Transform a derived JSON Schema (the canonical derivation, deriveJsonSchema) into
 * Gemini's responseSchema dialect: uppercase types, recursed properties and items,
 * carried required. `additionalProperties` and `$schema` are dropped (not part of
 * Google's Schema). The INPUT is the single canonical derivation; this is a transform
 * of that one source, never an independent schema. An unrecognized keyword throws
 * rather than being silently dropped.
 *
 * @param schema - The canonical derivation ({@link deriveJsonSchema} output) to transform.
 * @returns The same schema in Gemini's responseSchema dialect.
 * @throws A plain `Error` — NOT a {@link ProviderError} — when the input carries a JSON Schema keyword the
 *   transform does not handle. This is a developer-facing build invariant (the make-drift-fail-loudly
 *   guard): it fires only if the canonical schema gains a keyword without this transform being extended,
 *   never on provider input at runtime.
 */
export function toGeminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  for (const keyword of Object.keys(schema)) {
    if (!HANDLED_KEYWORDS.has(keyword)) {
      throw new Error(
        `toGeminiSchema: unsupported JSON Schema keyword '${keyword}' — the Gemini schema transform must be extended to handle it`,
      );
    }
  }
  const out: Record<string, unknown> = {};
  if (typeof schema.type === "string") {
    out.type = TYPE_MAP[schema.type] ?? schema.type.toUpperCase();
  }
  if (Array.isArray(schema.required)) {
    out.required = schema.required;
  }
  if (isRecord(schema.properties)) {
    const mapped: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      mapped[key] = isRecord(value) ? toGeminiSchema(value) : value;
    }
    out.properties = mapped;
  }
  if (isRecord(schema.items)) {
    out.items = toGeminiSchema(schema.items);
  }
  return out;
}
