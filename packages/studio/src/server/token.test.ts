import { describe, expect, it } from "vitest";
import { generateToken, tokensMatch } from "./token.js";

describe("generateToken", () => {
  it("generates a token with at least 128 bits of hex-encoded randomness", () => {
    const token = generateToken();

    expect(token).toMatch(/^[0-9a-f]+$/);
    expect(token.length).toBeGreaterThanOrEqual(32);
  });

  it("generates a different token on each call", () => {
    expect(generateToken()).not.toBe(generateToken());
  });
});

describe("tokensMatch", () => {
  const stored = generateToken();

  it("matches the exact stored token", () => {
    expect(tokensMatch(stored, stored)).toBe(true);
  });

  it("rejects a token that differs by one character", () => {
    const wrong = `${stored.slice(0, -1)}${stored.endsWith("0") ? "1" : "0"}`;
    expect(tokensMatch(wrong, stored)).toBe(false);
  });

  it("rejects an empty candidate without throwing", () => {
    expect(() => tokensMatch("", stored)).not.toThrow();
    expect(tokensMatch("", stored)).toBe(false);
  });

  it("rejects a much shorter candidate without throwing", () => {
    expect(() => tokensMatch("x", stored)).not.toThrow();
    expect(tokensMatch("x", stored)).toBe(false);
  });

  it("rejects a much longer candidate without throwing", () => {
    const longer = stored.repeat(10);
    expect(() => tokensMatch(longer, stored)).not.toThrow();
    expect(tokensMatch(longer, stored)).toBe(false);
  });
});
