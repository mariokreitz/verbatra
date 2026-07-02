import { describe, expect, it } from "vitest";
import { entry, resource } from "../testing/factories.js";
import { validate } from "./validate.js";

describe("validate", () => {
  it("returns an empty, valid report when nothing is wrong", () => {
    const source = resource("en", [entry({ key: "a" })]);
    const target = resource("de", [entry({ key: "a" })]);
    const report = validate(source, target);
    expect(report).toEqual({
      isValid: true,
      missingKeys: [],
      brokenPlaceholders: [],
      invalidIcu: [],
    });
  });

  it("reports keys missing from the target", () => {
    const source = resource("en", [entry({ key: "a" }), entry({ key: "b" })]);
    const target = resource("de", [entry({ key: "a" })]);
    const report = validate(source, target);
    expect(report.isValid).toBe(false);
    expect(report.missingKeys.map((f) => f.key)).toEqual(["b"]);
    expect(report.missingKeys[0]).toMatchObject({ key: "b", namespace: "common", locale: "de" });
  });

  it("reports broken placeholders with details", () => {
    const source = resource("en", [entry({ key: "a", placeholders: ["{x}"] })]);
    const target = resource("de", [entry({ key: "a", placeholders: [] })]);
    const report = validate(source, target);
    expect(report.brokenPlaceholders).toHaveLength(1);
    expect(report.brokenPlaceholders[0]).toMatchObject({ key: "a", missing: ["{x}"], extra: [] });
  });

  it("does not flag a pure placeholder reorder and keeps the report valid", () => {
    const source = resource("en", [entry({ key: "a", placeholders: ["{x}", "{y}"] })]);
    const target = resource("de", [entry({ key: "a", placeholders: ["{y}", "{x}"] })]);
    const report = validate(source, target);
    expect(report.brokenPlaceholders).toEqual([]);
    expect(report.isValid).toBe(true);
  });

  it("aggregates supplied invalid ICU findings without parsing ICU", () => {
    const source = resource("en", [entry({ key: "a" })]);
    const target = resource("de", [entry({ key: "a" })]);
    const report = validate(source, target, { invalidIcuKeys: ["a"] });
    expect(report.invalidIcu.map((f) => f.key)).toEqual(["a"]);
    expect(report.isValid).toBe(false);
  });

  it("ignores invalid ICU keys that are not present in the target", () => {
    const source = resource("en", [entry({ key: "a" })]);
    const target = resource("de", [entry({ key: "a" })]);
    const report = validate(source, target, { invalidIcuKeys: ["ghost"] });
    expect(report.invalidIcu).toEqual([]);
  });

  it("locates a finding by key, namespace and locale", () => {
    const source = resource("en", [entry({ key: "a", namespace: "auth" })], { namespace: "auth" });
    const target = resource("fr", [], { namespace: "auth" });
    const report = validate(source, target);
    expect(report.missingKeys[0]).toEqual({ key: "a", namespace: "auth", locale: "fr" });
  });

  it("handles plural entries without special-casing", () => {
    const source = resource("en", [entry({ key: "items", isPlural: true, placeholders: ["{n}"] })]);
    const target = resource("de", [entry({ key: "items", isPlural: true, placeholders: [] })]);
    const report = validate(source, target);
    expect(report.brokenPlaceholders.map((f) => f.key)).toEqual(["items"]);
  });

  it("sorts findings by key", () => {
    const source = resource("en", [entry({ key: "b" }), entry({ key: "a" }), entry({ key: "c" })]);
    const target = resource("de", []);
    expect(validate(source, target).missingKeys.map((f) => f.key)).toEqual(["a", "b", "c"]);
  });

  it("handles empty resources", () => {
    expect(validate(resource("en", []), resource("de", [])).isValid).toBe(true);
  });
});
