import { describe, expect, it } from "vitest";
import { SYSTEM_RULES as ANTHROPIC_SYSTEM_RULES } from "../anthropic/request.js";
import { GEMINI_SYSTEM_RULES } from "../gemini/request.js";
import { OPENAI_SYSTEM_RULES } from "../openai/request.js";
import { SHARED_SYSTEM_RULES } from "./system-rules.js";

describe("SHARED_SYSTEM_RULES", () => {
  it("carries no variable placeholder, staying a compile-time constant", () => {
    for (const line of SHARED_SYSTEM_RULES) {
      expect(line).not.toMatch(/\$\{/);
    }
  });

  it("prefixes every provider's assembled system rules, byte for byte", () => {
    const sharedBlock = SHARED_SYSTEM_RULES.join("\n");
    expect(ANTHROPIC_SYSTEM_RULES.startsWith(sharedBlock)).toBe(true);
    expect(OPENAI_SYSTEM_RULES.startsWith(sharedBlock)).toBe(true);
    expect(GEMINI_SYSTEM_RULES.startsWith(sharedBlock)).toBe(true);
  });

  it("leaves each provider exactly one trailing response-mechanism line after the shared block", () => {
    const sharedLineCount = SHARED_SYSTEM_RULES.length;
    expect(ANTHROPIC_SYSTEM_RULES.split("\n")).toHaveLength(sharedLineCount + 1);
    expect(OPENAI_SYSTEM_RULES.split("\n")).toHaveLength(sharedLineCount + 1);
    expect(GEMINI_SYSTEM_RULES.split("\n")).toHaveLength(sharedLineCount + 1);
  });

  it("gives OpenAI and Gemini the identical structured-object response line", () => {
    const openaiLast = OPENAI_SYSTEM_RULES.split("\n").at(-1);
    const geminiLast = GEMINI_SYSTEM_RULES.split("\n").at(-1);
    expect(openaiLast).toBe(geminiLast);
  });

  it("gives Anthropic a distinct forced tool-call response line", () => {
    const anthropicLast = ANTHROPIC_SYSTEM_RULES.split("\n").at(-1);
    expect(anthropicLast).toContain("submit_translations");
  });
});
