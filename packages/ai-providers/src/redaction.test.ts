import { describe, expect, it } from "vitest";
import { redact } from "./redaction.js";

describe("redact", () => {
  it("removes Anthropic-shaped key tokens", () => {
    const out = redact("auth failed for sk-ant-api03-ABCdef12345_-XYZ in request");
    expect(out).not.toContain("sk-ant-api03");
    expect(out).toContain("[REDACTED]");
  });

  it("removes OpenAI-shaped key tokens via the shared sk- prefix", () => {
    expect(redact("token sk-proj-ABCDEFGH1234")).not.toContain("sk-proj");
  });

  it("removes the exact known secret even when it is not key-shaped", () => {
    const out = redact("header x-token: hunter2hunter2", "hunter2hunter2");
    expect(out).not.toContain("hunter2hunter2");
    expect(out).toContain("[REDACTED]");
  });

  it("leaves text without secrets untouched", () => {
    expect(redact("a plain message", undefined)).toBe("a plain message");
  });

  it("uses the environment key as the default secret", () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "topsecretvalue";
    try {
      expect(redact("leak topsecretvalue here")).not.toContain("topsecretvalue");
    } finally {
      if (saved === undefined) {
        delete process.env.ANTHROPIC_API_KEY;
      } else {
        process.env.ANTHROPIC_API_KEY = saved;
      }
    }
  });
});
