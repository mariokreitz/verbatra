import { describe, expect, it } from "vitest";
import { buildPublishArgs, resolvePublishTag } from "./release-publish.mjs";

describe("resolvePublishTag", () => {
  it("returns the tag from pre.json when mode is pre", () => {
    const raw = JSON.stringify({ mode: "pre", tag: "next", initialVersions: {}, changesets: [] });
    expect(resolvePublishTag(raw)).toBe("next");
  });

  it("reads the tag from the file rather than hardcoding it", () => {
    const raw = JSON.stringify({ mode: "pre", tag: "beta" });
    expect(resolvePublishTag(raw)).toBe("beta");
  });

  it("returns null when mode is exit", () => {
    const raw = JSON.stringify({ mode: "exit", tag: "next" });
    expect(resolvePublishTag(raw)).toBeNull();
  });

  it("returns null when the file is absent", () => {
    expect(resolvePublishTag(null)).toBeNull();
  });

  it("throws on invalid JSON instead of falling through to an untagged publish", () => {
    expect(() => resolvePublishTag("{not json")).toThrow(".changeset/pre.json is not valid JSON");
  });

  it("throws when the parsed content is not an object", () => {
    expect(() => resolvePublishTag(JSON.stringify(["pre"]))).toThrow(
      ".changeset/pre.json does not contain an object",
    );
    expect(() => resolvePublishTag(JSON.stringify(null))).toThrow(
      ".changeset/pre.json does not contain an object",
    );
    expect(() => resolvePublishTag(JSON.stringify("pre"))).toThrow(
      ".changeset/pre.json does not contain an object",
    );
  });

  it("throws on an unknown mode", () => {
    expect(() => resolvePublishTag(JSON.stringify({ mode: "prerelease", tag: "next" }))).toThrow(
      'expected "pre" or "exit"',
    );
    expect(() => resolvePublishTag(JSON.stringify({ tag: "next" }))).toThrow(
      'expected "pre" or "exit"',
    );
  });

  it("throws when mode is pre but the tag is missing or not a string", () => {
    expect(() => resolvePublishTag(JSON.stringify({ mode: "pre" }))).toThrow(
      "is not a valid npm dist-tag",
    );
    expect(() => resolvePublishTag(JSON.stringify({ mode: "pre", tag: 7 }))).toThrow(
      "is not a valid npm dist-tag",
    );
  });

  it("throws when the tag could be mistaken for a flag or is otherwise malformed", () => {
    expect(() => resolvePublishTag(JSON.stringify({ mode: "pre", tag: "--registry" }))).toThrow(
      "is not a valid npm dist-tag",
    );
    expect(() => resolvePublishTag(JSON.stringify({ mode: "pre", tag: "" }))).toThrow(
      "is not a valid npm dist-tag",
    );
    expect(() => resolvePublishTag(JSON.stringify({ mode: "pre", tag: "next tag" }))).toThrow(
      "is not a valid npm dist-tag",
    );
  });
});

describe("buildPublishArgs", () => {
  it("appends --tag with the resolved tag in pre mode", () => {
    expect(buildPublishArgs("next")).toEqual(["exec", "changeset", "publish", "--tag", "next"]);
  });

  it("injects no --tag outside pre mode, matching today's publish exactly", () => {
    expect(buildPublishArgs(null)).toEqual(["exec", "changeset", "publish"]);
  });
});
