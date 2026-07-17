/**
 * Map a standard JSON Schema type keyword to Google's Schema Type enum. Gemini's
 * responseSchema dialect uses uppercase type names and has no additionalProperties.
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
 * Keywords the transform recognizes. `type`, `required`, `properties`, and `items` are transformed
 * or recursed; `$schema` and `additionalProperties` are intentionally dropped because Google's
 * Schema dialect rejects them. Any other keyword throws so a future addition to the canonical
 * schema surfaces loudly instead of being silently dropped.
 */
const HANDLED_KEYWORDS = new Set([
  "type",
  "required",
  "properties",
  "items",
  "$schema",
  "additionalProperties",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Transform a derived JSON Schema (the canonical derivation) into Gemini's responseSchema
 * dialect: uppercase types, recursed properties and items, carried required.
 * `additionalProperties` and `$schema` are dropped. An unrecognized keyword throws rather
 * than being silently dropped.
 *
 * @param schema - The canonical derivation ({@link deriveJsonSchema} output) to transform.
 * @returns The same schema in Gemini's responseSchema dialect.
 * @throws A plain `Error` (not a {@link ProviderError}) when the input carries a JSON Schema keyword the
 *   transform does not handle. This is a developer-facing build invariant, never provider input at runtime.
 */
export function toGeminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  for (const keyword of Object.keys(schema)) {
    if (!HANDLED_KEYWORDS.has(keyword)) {
      throw new Error(
        `toGeminiSchema: unsupported JSON Schema keyword '${keyword}'. The Gemini schema transform must be extended to handle it`,
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
