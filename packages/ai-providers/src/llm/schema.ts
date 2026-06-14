import { z } from "zod";

/**
 * The canonical per-key translation result. This is the SINGLE SOURCE OF TRUTH:
 * the shared layer validates provider output against this schema, and every
 * provider's API-specific schema form (Anthropic tool input_schema, OpenAI
 * json_schema) is derived from it via deriveJsonSchema. The constraint a provider
 * imposes on the model and the validation the shared layer performs therefore
 * cannot drift apart.
 */
export const translationsResultSchema = z.object({
  translations: z.array(z.object({ key: z.string(), value: z.string() })),
});

export type TranslationsResult = z.infer<typeof translationsResultSchema>;

/**
 * Derive the JSON Schema form a provider hands to its model from a zod schema.
 * The `$schema` annotation is dropped so the result is a bare JSON Schema suitable
 * for both Anthropic tool input and OpenAI Structured Outputs.
 */
export function deriveJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(json)) {
    if (key !== "$schema") {
      result[key] = value;
    }
  }
  return result;
}
