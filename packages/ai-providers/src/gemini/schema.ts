const TYPE_MAP: Record<string, string> = {
  string: "STRING",
  number: "NUMBER",
  integer: "INTEGER",
  boolean: "BOOLEAN",
  array: "ARRAY",
  object: "OBJECT",
};

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
