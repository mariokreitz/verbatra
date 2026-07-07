import { describe, expect, it } from "vitest";
import { isAllowedHost, isAllowedOrigin } from "./host-origin.js";

describe("isAllowedHost", () => {
  it("accepts exactly 127.0.0.1:PORT", () => {
    expect(isAllowedHost("127.0.0.1:5849", 5849)).toBe(true);
  });

  it("accepts the host part case-insensitively (never has letters in practice, but the check is case-insensitive)", () => {
    expect(isAllowedHost("127.0.0.1:5849".toUpperCase(), 5849)).toBe(true);
  });

  it("rejects localhost even with the correct port", () => {
    expect(isAllowedHost("localhost:5849", 5849)).toBe(false);
  });

  it("rejects the IPv6 loopback literal", () => {
    expect(isAllowedHost("[::1]:5849", 5849)).toBe(false);
  });

  it("rejects a missing Host header", () => {
    expect(isAllowedHost(undefined, 5849)).toBe(false);
  });

  it("rejects a Host header missing the port", () => {
    expect(isAllowedHost("127.0.0.1", 5849)).toBe(false);
  });

  it("rejects a Host header with the wrong port", () => {
    expect(isAllowedHost("127.0.0.1:9999", 5849)).toBe(false);
  });

  it("rejects Host 127.0.0.1:0 for a server bound on an ephemeral port", () => {
    expect(isAllowedHost("127.0.0.1:0", 5851)).toBe(false);
  });
});

describe("isAllowedOrigin", () => {
  it("allows an absent Origin", () => {
    expect(isAllowedOrigin(undefined, 5849)).toBe(true);
  });

  it("accepts exactly http://127.0.0.1:PORT", () => {
    expect(isAllowedOrigin("http://127.0.0.1:5849", 5849)).toBe(true);
  });

  it("rejects the literal null origin", () => {
    expect(isAllowedOrigin("null", 5849)).toBe(false);
  });

  it("rejects a foreign origin", () => {
    expect(isAllowedOrigin("http://evil.example", 5849)).toBe(false);
  });

  it("rejects a mismatched port", () => {
    expect(isAllowedOrigin("http://127.0.0.1:9999", 5849)).toBe(false);
  });

  it("rejects https on the loopback origin", () => {
    expect(isAllowedOrigin("https://127.0.0.1:5849", 5849)).toBe(false);
  });
});
