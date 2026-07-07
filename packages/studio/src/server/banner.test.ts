import { describe, expect, it } from "vitest";
import { buildBanner } from "./banner.js";

describe("buildBanner", () => {
  it("appends the token as a query parameter on the given url", () => {
    expect(buildBanner("http://127.0.0.1:5849/", "abc123")).toBe(
      "verbatra studio listening at http://127.0.0.1:5849/?token=abc123",
    );
  });
});
