import { describe, expect, it } from "vitest";
import { redact } from "./redaction.js";

describe("redact", () => {
  it("removes OpenAI sk- key tokens", () => {
    const out = redact("token sk-ABCDEFGH1234567890 here");
    expect(out).not.toContain("sk-ABCDEFGH");
    expect(out).toContain("[REDACTED]");
  });

  it("removes OpenAI sk-proj- key tokens", () => {
    const out = redact("token sk-proj-ABCDEFGH1234 here");
    expect(out).not.toContain("sk-proj");
    expect(out).toContain("[REDACTED]");
  });

  it("removes Anthropic sk-ant- key tokens", () => {
    const out = redact("auth failed for sk-ant-api03-ABCdef12345_-XYZ in request");
    expect(out).not.toContain("sk-ant-api03");
    expect(out).toContain("[REDACTED]");
  });

  it("removes Gemini AIza key tokens (39 chars total)", () => {
    const key = "AIzaabcdefghijklmnopqrstuvwxyz012345678";
    expect(key).toHaveLength(39);
    const out = redact(`key ${key} trailing`);
    expect(out).not.toContain("AIza");
    expect(out).toContain("[REDACTED]");
  });

  it("removes DeepL UUID key tokens", () => {
    const key = "12345678-1234-1234-1234-123456789012";
    const out = redact(`auth ${key} end`);
    expect(out).not.toContain(key);
    expect(out).toContain("[REDACTED]");
  });

  it("removes DeepL UUID key tokens with the :fx free-tier suffix", () => {
    const key = "abcdef12-3456-7890-abcd-ef1234567890:fx";
    const out = redact(`auth ${key} end`);
    expect(out).not.toContain(key);
    expect(out).not.toContain(":fx");
    expect(out).toContain("[REDACTED]");
  });

  it("removes the exact known secret even when it is not key-shaped", () => {
    const out = redact("header x-token: hunter2hunter2", "hunter2hunter2");
    expect(out).not.toContain("hunter2hunter2");
    expect(out).toContain("[REDACTED]");
  });

  it("leaves text without secrets untouched", () => {
    expect(redact("a plain message", undefined)).toBe("a plain message");
  });

  it("does not over-redact ordinary prose or wrong-length hex runs", () => {
    const input = "a well-known state-of-the-art plan with id 12345678-1234-1234-1234-12345";
    expect(redact(input, undefined)).toBe(input);
  });

  it("does not redact `sk-` runs that sit mid-word (no word boundary)", () => {
    for (const word of ["risk-assessment", "task-management", "desk-organizer", "ask-question"]) {
      expect(redact(word, undefined)).toBe(word);
    }
  });

  it("redacts a genuine sk-ant key sitting at a word boundary", () => {
    const out = redact("auth failed for sk-ant-api03-ABCdef12345_-XYZ", undefined);
    expect(out).not.toContain("sk-ant-api03");
    expect(out).toContain("[REDACTED]");
  });

  it("redacts an inline key after punctuation (punctuation is a word boundary)", () => {
    const out = redact("key=sk-proj-ABCDEFGH1234 here", undefined);
    expect(out).not.toContain("sk-proj");
    expect(out).toContain("[REDACTED]");
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

  it("returns promptly on a long pathological near-miss input (ReDoS-safe)", () => {
    const nearMiss = `${"abcdef0123456789".repeat(8000)} sk ${"AIz".repeat(8000)}`;
    const start = Date.now();
    const out = redact(nearMiss, undefined);
    expect(Date.now() - start).toBeLessThan(1000);
    expect(out).toBe(nearMiss);
  });
});
