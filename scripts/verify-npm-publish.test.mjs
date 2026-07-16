import { describe, expect, it } from "vitest";
import {
  isLatestTagViolation,
  isPrereleaseVersion,
  parsePublishedPackages,
} from "./verify-npm-publish.mjs";

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

describe("isPrereleaseVersion", () => {
  it("classifies stable versions as non-prerelease", () => {
    expect(isPrereleaseVersion("0.4.4")).toBe(false);
    expect(isPrereleaseVersion("1.0.0")).toBe(false);
  });

  it("classifies versions with a prerelease component as prerelease", () => {
    expect(isPrereleaseVersion("0.1.0-next.7")).toBe(true);
    expect(isPrereleaseVersion("1.0.0-rc.1")).toBe(true);
    expect(isPrereleaseVersion("2.0.0-alpha")).toBe(true);
  });

  it("ignores build metadata when classifying", () => {
    expect(isPrereleaseVersion("1.2.3+build.5")).toBe(false);
    expect(isPrereleaseVersion("1.2.3-rc.1+build.5")).toBe(true);
  });

  it("throws on a version that is not valid semver", () => {
    expect(() => isPrereleaseVersion("not-semver")).toThrow("is not valid semver");
    expect(() => isPrereleaseVersion("1.2")).toThrow("is not valid semver");
    expect(() => isPrereleaseVersion("")).toThrow("is not valid semver");
  });
});

describe("isLatestTagViolation", () => {
  it("flags a just-published prerelease that sits on the latest dist-tag", () => {
    expect(isLatestTagViolation("0.1.0-next.7", "0.1.0-next.7")).toBe(true);
  });

  it("passes when latest points at a stable version", () => {
    expect(isLatestTagViolation("0.5.0-next.5", "0.4.4")).toBe(false);
  });

  it("passes when latest is stuck on an older prerelease from before the guard", () => {
    // The @verbatra/studio state this check must not trip on: latest = 0.1.0-next.6
    // predates the guard; only the version published in this run counts.
    expect(isLatestTagViolation("0.1.0-next.7", "0.1.0-next.6")).toBe(false);
  });

  it("passes for a stable publish even when latest points at it", () => {
    expect(isLatestTagViolation("0.5.0", "0.5.0")).toBe(false);
  });

  it("passes when the package has no latest dist-tag at all", () => {
    expect(isLatestTagViolation("0.1.0-next.1", null)).toBe(false);
  });
});
