import { describe, expect, it } from "vitest";
import { isJsonRequestContentType } from "./request-content-type.js";

describe("isJsonRequestContentType", () => {
  it("accepts an exact application/json match", () => {
    expect(isJsonRequestContentType("application/json")).toBe(true);
  });

  it("accepts application/json with surrounding whitespace and different casing", () => {
    expect(isJsonRequestContentType("  Application/JSON  ")).toBe(true);
  });

  it("rejects a charset parameter", () => {
    expect(isJsonRequestContentType("application/json; charset=utf-8")).toBe(false);
  });

  it("rejects a missing content type", () => {
    expect(isJsonRequestContentType(undefined)).toBe(false);
  });

  it("rejects an unrelated content type", () => {
    expect(isJsonRequestContentType("text/plain")).toBe(false);
  });
});
