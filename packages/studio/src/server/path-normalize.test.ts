import { sep } from "node:path";
import { describe, expect, it } from "vitest";
import { withoutTrailingSep } from "./path-normalize.js";

describe("withoutTrailingSep", () => {
  it("strips a single trailing separator", () => {
    expect(withoutTrailingSep(`/project${sep}`)).toBe("/project");
  });

  it("leaves a path with no trailing separator unchanged", () => {
    expect(withoutTrailingSep("/project")).toBe("/project");
  });

  it("leaves a bare separator unchanged, never returning an empty string", () => {
    expect(withoutTrailingSep(sep)).toBe(sep);
  });
});
