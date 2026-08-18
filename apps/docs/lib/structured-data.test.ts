import { describe, expect, it } from "vitest";
import { organizationLd, techArticleLd, websiteLd } from "./structured-data";

const ORGANIZATION_NODE = {
  "@type": "Organization",
  name: "verbatra",
  url: "https://verbatra.kreitz-webdev.de",
};

describe("organizationLd", () => {
  it("names verbatra and links its GitHub presence through sameAs", () => {
    expect(organizationLd()).toEqual({
      "@context": "https://schema.org",
      ...ORGANIZATION_NODE,
      sameAs: ["https://github.com/verbatra/verbatra"],
    });
  });
});

describe("websiteLd", () => {
  it("publishes under the same organization node as organizationLd", () => {
    expect(websiteLd({ lang: "en" }).publisher).toEqual(ORGANIZATION_NODE);
  });
});

describe("techArticleLd", () => {
  it("publishes under the same organization node as organizationLd", () => {
    const result = techArticleLd({
      title: "Providers",
      path: "/docs/providers",
      lang: "en",
    });
    expect(result.publisher).toEqual(ORGANIZATION_NODE);
  });
});
