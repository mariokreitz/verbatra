import { describe, expect, it } from "vitest";
import { DEFAULT_STUDIO_PORT, resolvePort } from "./default-port.js";

describe("resolvePort", () => {
  it("falls back to the default port when none is given", () => {
    expect(resolvePort(undefined)).toBe(DEFAULT_STUDIO_PORT);
  });

  it("preserves an explicit port 0 rather than falling back", () => {
    expect(resolvePort(0)).toBe(0);
  });

  it("preserves an explicit non-default port", () => {
    expect(resolvePort(3000)).toBe(3000);
  });
});
