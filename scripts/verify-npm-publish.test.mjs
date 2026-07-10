import { describe, expect, it } from "vitest";
import { parsePublishedPackages } from "./verify-npm-publish.mjs";

describe("parsePublishedPackages", () => {
  it("parses a valid publishedPackages payload", () => {
    const raw = JSON.stringify([
      { name: "@verbatra/sdk", version: "0.5.0" },
      { name: "@verbatra/cli", version: "0.5.0" },
    ]);

    expect(parsePublishedPackages(raw)).toEqual([
      { name: "@verbatra/sdk", version: "0.5.0" },
      { name: "@verbatra/cli", version: "0.5.0" },
    ]);
  });

  it("throws when the input is undefined", () => {
    expect(() => parsePublishedPackages(undefined)).toThrow(
      "PUBLISHED_PACKAGES_JSON is empty; nothing to verify.",
    );
  });

  it("throws when the input is an empty or blank string", () => {
    expect(() => parsePublishedPackages("")).toThrow(
      "PUBLISHED_PACKAGES_JSON is empty; nothing to verify.",
    );
    expect(() => parsePublishedPackages("   ")).toThrow(
      "PUBLISHED_PACKAGES_JSON is empty; nothing to verify.",
    );
  });

  it("throws when the input is not valid JSON", () => {
    expect(() => parsePublishedPackages("{not json")).toThrow(
      "PUBLISHED_PACKAGES_JSON is not valid JSON",
    );
  });

  it("throws when the parsed JSON is not an array", () => {
    expect(() => parsePublishedPackages(JSON.stringify({ name: "@verbatra/sdk" }))).toThrow(
      "publishedPackages is empty or not an array",
    );
  });

  it("throws when the parsed JSON is an empty array", () => {
    expect(() => parsePublishedPackages("[]")).toThrow(
      "publishedPackages is empty or not an array",
    );
  });

  it("throws when an entry is missing the name or version field", () => {
    expect(() => parsePublishedPackages(JSON.stringify([{ name: "@verbatra/sdk" }]))).toThrow(
      "publishedPackages[0] is missing a string name/version",
    );
    expect(() =>
      parsePublishedPackages(JSON.stringify([{ name: "@verbatra/sdk", version: 5 }])),
    ).toThrow("publishedPackages[0] is missing a string name/version");
  });

  it("throws when an entry is not an object", () => {
    expect(() => parsePublishedPackages(JSON.stringify(["@verbatra/sdk"]))).toThrow(
      "publishedPackages[0] is missing a string name/version",
    );
    expect(() => parsePublishedPackages(JSON.stringify([null]))).toThrow(
      "publishedPackages[0] is missing a string name/version",
    );
  });
});
