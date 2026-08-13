import { z } from "zod";

export const translationsResultSchema = z.object({
  translations: z.array(z.object({ key: z.string(), value: z.string() })),
});

export type TranslationsResult = z.infer<typeof translationsResultSchema>;

export interface JsonObjectSchema {
  readonly type: "object";
  readonly [keyword: string]: unknown;
}

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
