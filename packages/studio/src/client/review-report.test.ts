import { describe, expect, it } from "vitest";
import type { DiffLocale } from "./diff-view.js";
import { buildReviewReportMarkdown } from "./review-report.js";

const MULTI_LOCALE: readonly DiffLocale[] = [
  {
    locale: "de",
    hasPendingChanges: true,
    missing: ["greeting", "farewell"],
    changed: ["title"],
    orphaned: [],
  },
  {
    locale: "fr",
    hasPendingChanges: false,
    missing: [],
    changed: [],
    orphaned: ["legacy.key"],
  },
];

describe("buildReviewReportMarkdown", () => {
  it("reports no locales when the diff data is empty", () => {
    const report = buildReviewReportMarkdown([]);

    expect(report).toContain("No locales are currently loaded.");
  });

  it("includes a heading per locale, in the given order", () => {
    const report = buildReviewReportMarkdown(MULTI_LOCALE);

    const deIndex = report.indexOf("## de");
    const frIndex = report.indexOf("## fr");
    expect(deIndex).toBeGreaterThanOrEqual(0);
    expect(frIndex).toBeGreaterThan(deIndex);
  });

  it("includes the missing, changed, and orphaned counts and key names for each locale", () => {
    const report = buildReviewReportMarkdown(MULTI_LOCALE);

    expect(report).toContain("Missing (2): greeting, farewell");
    expect(report).toContain("Changed (1): title");
    expect(report).toContain("Orphaned (0): (none)");
    expect(report).toContain("Missing (0): (none)");
    expect(report).toContain("Changed (0): (none)");
    expect(report).toContain("Orphaned (1): legacy.key");
  });

  it("reflects every key, not a capped subset, for a locale with many keys", () => {
    const manyKeys = Array.from({ length: 600 }, (_, index) => `key.${index}`);
    const locales: readonly DiffLocale[] = [
      { locale: "de", hasPendingChanges: true, missing: manyKeys, changed: [], orphaned: [] },
    ];

    const report = buildReviewReportMarkdown(locales);

    expect(report).toContain(`Missing (${manyKeys.length}):`);
    expect(report).toContain("key.599");
  });

  it("contains no em dash character anywhere", () => {
    const emDash = String.fromCharCode(0x2014);
    const report = buildReviewReportMarkdown(MULTI_LOCALE);

    expect(report).not.toContain(emDash);
  });

  it("contains no em dash character even for an empty diff", () => {
    const emDash = String.fromCharCode(0x2014);
    const report = buildReviewReportMarkdown([]);

    expect(report).not.toContain(emDash);
  });
});
