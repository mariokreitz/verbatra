import { describe, expect, it } from "vitest";
import { ProviderError } from "../errors.js";
import { parseTranslations } from "./response.js";

function toolUse(input: unknown): readonly unknown[] {
  return [{ type: "tool_use", id: "t", name: "submit_translations", input }];
}

describe("parseTranslations", () => {
  it("maps each translation back to its requested key", () => {
    const content = toolUse({
      translations: [
        { key: "a", value: "A" },
        { key: "b", value: "B" },
      ],
    });
    const values = parseTranslations(content, ["a", "b"]);
    expect(values.get("a")).toBe("A");
    expect(values.get("b")).toBe("B");
  });

  it("rejects content with no submit_translations tool-use block", () => {
    const content = [{ type: "text", text: "here you go" }];
    expect(() => parseTranslations(content, ["a"])).toThrow(ProviderError);
  });

  it("rejects a malformed tool input shape", () => {
    expect(() => parseTranslations(toolUse({ translations: "nope" }), ["a"])).toThrow(
      ProviderError,
    );
  });

  it("rejects an extra key the request did not ask for", () => {
    const content = toolUse({
      translations: [
        { key: "a", value: "A" },
        { key: "z", value: "Z" },
      ],
    });
    expect(() => parseTranslations(content, ["a"])).toThrow(ProviderError);
  });

  it("rejects a duplicate key", () => {
    const content = toolUse({
      translations: [
        { key: "a", value: "A" },
        { key: "a", value: "A2" },
      ],
    });
    expect(() => parseTranslations(content, ["a"])).toThrow(ProviderError);
  });

  it("rejects a response missing a requested key", () => {
    const content = toolUse({ translations: [{ key: "a", value: "A" }] });
    expect(() => parseTranslations(content, ["a", "b"])).toThrow(ProviderError);
  });

  it("surfaces INVALID_RESPONSE as the error code", () => {
    try {
      parseTranslations([], ["a"]);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as ProviderError).code).toBe("INVALID_RESPONSE");
    }
  });
});
