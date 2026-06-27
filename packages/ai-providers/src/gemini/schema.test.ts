import { describe, expect, it } from "vitest";
import { deriveJsonSchema, translationsResultSchema } from "../llm/schema.js";
import { toGeminiSchema } from "./schema.js";

describe("toGeminiSchema", () => {
  it("maps the canonical derivation to Gemini's dialect (uppercase types, no additionalProperties)", () => {
    const out = toGeminiSchema(deriveJsonSchema(translationsResultSchema));
    expect(out).toEqual({
      type: "OBJECT",
      required: ["translations"],
      properties: {
        translations: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            required: ["key", "value"],
            properties: { key: { type: "STRING" }, value: { type: "STRING" } },
          },
        },
      },
    });
    expect(out).not.toHaveProperty("additionalProperties");
  });

  it("uppercases an unmapped type and passes through a non-record property value", () => {
    const out = toGeminiSchema({ type: "null", properties: { x: "raw" } });
    expect(out.type).toBe("NULL");
    expect((out.properties as Record<string, unknown>).x).toBe("raw");
  });

  it("omits type when the input has none (defensive)", () => {
    const out = toGeminiSchema({ required: ["x"] });
    expect(out).not.toHaveProperty("type");
    expect(out.required).toEqual(["x"]);
  });

  it("throws naming a top-level unsupported keyword instead of dropping it", () => {
    expect(() => toGeminiSchema({ type: "array", minItems: 1 })).toThrow(/minItems/);
  });

  it("throws naming a nested unsupported keyword", () => {
    expect(() =>
      toGeminiSchema({ type: "object", properties: { x: { type: "string", enum: ["a"] } } }),
    ).toThrow(/enum/);
  });
});
