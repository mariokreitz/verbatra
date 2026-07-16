import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE, PAGE_IDS, pageHash, parsePageHash } from "./routes.js";

describe("parsePageHash", () => {
  it.each(PAGE_IDS)("parses the canonical #/%s form", (page) => {
    expect(parsePageHash(`#/${page}`)).toBe(page);
  });

  it.each(PAGE_IDS)("accepts the bare #%s form", (page) => {
    expect(parsePageHash(`#${page}`)).toBe(page);
  });

  it("falls back to the default workspace for an empty hash", () => {
    expect(parsePageHash("")).toBe(DEFAULT_PAGE);
    expect(parsePageHash("#")).toBe(DEFAULT_PAGE);
    expect(parsePageHash("#/")).toBe(DEFAULT_PAGE);
  });

  it("falls back to the default workspace for an unknown or stale hash", () => {
    expect(parsePageHash("#/diff")).toBe(DEFAULT_PAGE);
    expect(parsePageHash("#/status")).toBe(DEFAULT_PAGE);
    expect(parsePageHash("#/nonsense")).toBe(DEFAULT_PAGE);
  });
});

describe("pageHash", () => {
  it.each(PAGE_IDS)("writes the canonical form for %s and round-trips", (page) => {
    expect(pageHash(page)).toBe(`#/${page}`);
    expect(parsePageHash(pageHash(page))).toBe(page);
  });
});

describe("PAGE_IDS", () => {
  it("keeps the default workspace first in sidebar order", () => {
    expect(PAGE_IDS[0]).toBe(DEFAULT_PAGE);
  });
});
