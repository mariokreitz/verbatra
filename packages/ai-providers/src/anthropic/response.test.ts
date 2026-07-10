import { describe, expect, it } from "vitest";
import { ProviderError } from "../errors.js";
import { requireToolInput } from "./response.js";

function toolUse(input: unknown): readonly unknown[] {
  return [{ type: "tool_use", id: "t", name: "submit_translations", input }];
}

describe("requireToolInput", () => {
  it("returns the forced tool-use block's input, as unparsed data", () => {
    const input = { translations: [{ key: "a", value: "A" }] };
    expect(requireToolInput(toolUse(input))).toBe(input);
  });

  it("finds the submit_translations block among other content blocks", () => {
    const input = { translations: [] };
    const content = [{ type: "text", text: "preamble" }, ...toolUse(input)];
    expect(requireToolInput(content)).toBe(input);
  });

  it("rejects content with no submit_translations tool-use block", () => {
    const content = [{ type: "text", text: "here you go" }];
    expect(() => requireToolInput(content)).toThrow(ProviderError);
  });

  it("rejects an empty content array", () => {
    expect(() => requireToolInput([])).toThrow(ProviderError);
  });

  it("surfaces INVALID_RESPONSE as the error code", () => {
    try {
      requireToolInput([]);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as ProviderError).code).toBe("INVALID_RESPONSE");
    }
  });
});
