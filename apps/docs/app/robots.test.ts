import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots", () => {
  it("allows everything except the search API route", () => {
    const result = robots();
    expect(result.rules).toEqual({
      userAgent: "*",
      allow: "/",
      disallow: ["/api/search"],
    });
  });

  it("points at the sitemap and the site host", () => {
    const result = robots();
    expect(result.sitemap).toBe("https://verbatra.kreitz-webdev.de/sitemap.xml");
    expect(result.host).toBe("https://verbatra.kreitz-webdev.de");
  });
});
