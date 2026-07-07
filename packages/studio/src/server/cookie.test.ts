import { describe, expect, it } from "vitest";
import { buildSetCookieHeader, cookieName, readCookieValue } from "./cookie.js";

describe("cookieName", () => {
  it("suffixes the cookie name with the bound port", () => {
    expect(cookieName(5849)).toBe("verbatra_studio_5849");
    expect(cookieName(0)).toBe("verbatra_studio_0");
  });
});

describe("readCookieValue", () => {
  it("returns undefined when the header is absent", () => {
    expect(readCookieValue(undefined, "verbatra_studio_5849")).toBeUndefined();
  });

  it("reads the value of the named cookie among several", () => {
    const header = "other=1; verbatra_studio_5849=abc123; another=2";
    expect(readCookieValue(header, "verbatra_studio_5849")).toBe("abc123");
  });

  it("ignores a same-prefix cookie for a different port", () => {
    const header = "verbatra_studio_9999=garbage; verbatra_studio_5849=abc123";
    expect(readCookieValue(header, "verbatra_studio_5849")).toBe("abc123");
    expect(readCookieValue(header, "verbatra_studio_9999")).toBe("garbage");
  });

  it("returns undefined when the named cookie is not present", () => {
    expect(readCookieValue("other=1", "verbatra_studio_5849")).toBeUndefined();
  });

  it("ignores a cookie pair with no equals sign", () => {
    expect(readCookieValue("malformed; verbatra_studio_5849=abc", "verbatra_studio_5849")).toBe(
      "abc",
    );
  });
});

describe("buildSetCookieHeader", () => {
  it("builds a session cookie with no Secure flag and no expiry", () => {
    const header = buildSetCookieHeader("verbatra_studio_5849", "abc123");

    expect(header).toBe("verbatra_studio_5849=abc123; Path=/; HttpOnly; SameSite=Strict");
    expect(header).not.toMatch(/Secure/i);
    expect(header).not.toMatch(/Max-Age|Expires/i);
  });
});
