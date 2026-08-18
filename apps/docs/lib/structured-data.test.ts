import { describe, expect, it } from "vitest";
import { organizationLd, techArticleLd, websiteLd } from "./structured-data";

const ORGANIZATION_ID = "https://verbatra.kreitz-webdev.de/#organization";

const ORGANIZATION_NODE = {
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: "verbatra",
  url: "https://verbatra.kreitz-webdev.de",
};

const ORGANIZATION_REF = { "@id": ORGANIZATION_ID };

describe("organizationLd", () => {
  it("names verbatra, carries a stable @id, and links its GitHub org through sameAs", () => {
    expect(organizationLd()).toEqual({
      "@context": "https://schema.org",
      ...ORGANIZATION_NODE,
      sameAs: ["https://github.com/verbatra"],
    });
  });
});

describe("websiteLd", () => {
  it("references the organization node by @id instead of embedding it", () => {
    expect(websiteLd({ lang: "en" }).publisher).toEqual(ORGANIZATION_REF);
  });
});

describe("techArticleLd", () => {
  it("references the organization node by @id instead of embedding it", () => {
    const result = techArticleLd({
      title: "Providers",
      path: "/docs/providers",
      lang: "en",
    });
    expect(result.publisher).toEqual(ORGANIZATION_REF);
  });
});
