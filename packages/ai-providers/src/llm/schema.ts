import { z } from "zod";

/**
 * The canonical per-key translation result and single source of truth: the shared layer validates provider
 * output against this schema, and every provider's API-specific schema form is derived from it, so the
 * model constraint and the shared validation cannot drift apart.
 */
export const translationsResultSchema = z.object({
  translations: z.array(z.object({ key: z.string(), value: z.string() })),
});

/** The inferred shape of {@link translationsResultSchema}: a list of `{ key, value }` translations. */
export type TranslationsResult = z.infer<typeof translationsResultSchema>;

/**
 * A bare JSON Schema describing an object. The literal `type: "object"` is carried in the type
 * because Anthropic's tool `input_schema` requires it; without it the derivation would only be
 * assignable to the vendor parameter through a cast that would also hide unrelated mismatches.
 */
export interface JsonObjectSchema {
  readonly type: "object";
  readonly [keyword: string]: unknown;
}

/**
 * Derive the JSON Schema form a provider hands to its model from a zod object schema.
 * The `$schema` annotation is dropped so the result is a bare JSON Schema suitable
 * for both Anthropic tool input and OpenAI Structured Outputs.
 *
 * The parameter is a `ZodObject` rather than any `ZodType` so the declared `type: "object"` on
 * the result is guaranteed by construction: an object schema always converts to that keyword.
 *
 * @param schema - The zod object schema to convert; in practice {@link translationsResultSchema}.
 * @returns A bare JSON Schema object (no `$schema` key).
 */
export function deriveJsonSchema(schema: z.ZodObject): JsonObjectSchema {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(json)) {
    if (key !== "$schema") {
      result[key] = value;
    }
  }
  return { ...result, type: "object" };
}
