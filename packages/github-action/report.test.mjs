import { describe, expect, it } from "vitest";
import { buildReport, extractCliError, parseSummaryJson } from "./report.mjs";

function locale(over = {}) {
  return {
    locale: "de",
    status: "succeeded",
    translated: [],
    unchanged: [],
    orphaned: [],
    invalidIcuSource: [],
    integrityMismatches: [],
    notices: [],
    ...over,
  };
}

function summary(over = {}) {
  return { dryRun: false, locales: [], succeeded: [], failed: [], ...over };
}

const noEmoji = (text) => expect(/\p{Extended_Pictographic}/u.test(text)).toBe(false);

describe("buildReport: exit code is a literal pass-through", () => {
  it("clean (exit 0): no annotations, exitStatus 0, a summary", () => {
    const s = summary({
      locales: [locale({ translated: ["a", "b"], unchanged: ["c"] })],
      succeeded: ["de"],
    });
    const report = buildReport(s, 0);
    expect(report.annotations).toEqual([]);
    expect(report.exitStatus).toBe(0);
    expect(report.summary).toContain("1 locales: 1 succeeded, 0 failed");
    expect(report.summary).toContain("| de | ok | 2 | 1 |");
    noEmoji(report.summary);
  });

  it("exitStatus mirrors the CLI code exactly, not re-derived from summary.failed", () => {
    expect(buildReport(summary({ succeeded: ["de"] }), 0).exitStatus).toBe(0);
    expect(buildReport(summary({ succeeded: ["de"] }), 2).exitStatus).toBe(2);
  });
});

describe("buildReport: per-locale failure (exit 1): the conjunction criterion", () => {
  it("produces one annotation per failed locale AND a non-zero exitStatus in the SAME result", () => {
    const s = summary({
      locales: [
        locale({ locale: "de", translated: ["x"] }),
        locale({
          locale: "fr",
          status: "failed",
          error: { code: "LOCALE_FAILED", message: "provider 503" },
        }),
        locale({
          locale: "es",
          status: "failed",
          error: { code: "SOURCE_INVALID", message: "bad icu" },
        }),
      ],
      succeeded: ["de"],
      failed: ["fr", "es"],
    });
    const report = buildReport(s, 1);

    expect(report.annotations).toHaveLength(2);
    expect(report.exitStatus).not.toBe(0);
    expect(report.exitStatus).toBe(1);

    expect(report.annotations[0]).toContain("title=verbatra%3A fr");
    expect(report.annotations[0]).toContain("[LOCALE_FAILED] provider 503");
    expect(report.annotations[1]).toContain("title=verbatra%3A es");
    expect(report.annotations[1]).toContain("[SOURCE_INVALID] bad icu");
    expect(report.summary).toContain("Failed locales:");
    expect(report.summary).toContain("- fr: [LOCALE_FAILED] provider 503");
    noEmoji(report.summary);
  });
});

describe("buildReport: whole-run error (exit 2, empty stdout)", () => {
  it("uses the captured stderr {code,message}; one annotation; exitStatus 2", () => {
    const stderr =
      "verbatra: error [CONFIG_NOT_FOUND] No verbatra configuration found. Create a verbatra.config.ts.";
    const report = buildReport(null, 2, stderr);
    expect(report.annotations).toHaveLength(1);
    expect(report.annotations[0]).toContain("[CONFIG_NOT_FOUND] No verbatra configuration found");
    expect(report.exitStatus).toBe(2);
    expect(report.summary).toContain("verbatra run failed");
    expect(report.summary).toContain("exit 2");
    noEmoji(report.summary);
  });

  it("falls back to a generic message when stderr has no recognizable error line", () => {
    const report = buildReport(null, 2, "");
    expect(report.annotations).toHaveLength(1);
    expect(report.annotations[0]).toContain("[VERBATRA_FAILED]");
    expect(report.exitStatus).toBe(2);
  });
});

describe("buildReport: dry-run mirrors the CLI", () => {
  it("exit 0 with pending work: no failure, the would-change summary is still produced", () => {
    const s = summary({
      dryRun: true,
      locales: [locale({ translated: ["pending1", "pending2"] })],
      succeeded: ["de"],
    });
    const report = buildReport(s, 0);
    expect(report.annotations).toEqual([]);
    expect(report.exitStatus).toBe(0);
    expect(report.summary).toContain("(dry run)");
    expect(report.summary).toContain("dry run: nothing written");
    expect(report.summary).toContain("| de | ok | 2 |");
    noEmoji(report.summary);
  });
});

describe("parseSummaryJson: empty-stdout handling (no JSON.parse crash)", () => {
  it("returns null for empty/blank stdout and an object for real JSON", () => {
    expect(parseSummaryJson("")).toBeNull();
    expect(parseSummaryJson("   \n  ")).toBeNull();
    expect(parseSummaryJson("not json")).toBeNull();
    expect(parseSummaryJson(JSON.stringify(summary({ succeeded: ["de"] })))).toMatchObject({
      succeeded: ["de"],
    });
  });

  it("empty stdout + exit 2 routes through the whole-run path end to end", () => {
    const report = buildReport(
      parseSummaryJson(""),
      2,
      "verbatra: error [SOURCE_UNREADABLE] missing",
    );
    expect(report.exitStatus).toBe(2);
    expect(report.annotations[0]).toContain("[SOURCE_UNREADABLE] missing");
  });
});

describe("buildReport: defensive branches", () => {
  it("a failed locale with no error object falls back to LOCALE_FAILED / 'locale failed'", () => {
    const s = summary({
      locales: [locale({ locale: "fr", status: "failed" })],
      failed: ["fr"],
    });
    const report = buildReport(s, 1);
    expect(report.annotations[0]).toContain("[LOCALE_FAILED] locale failed");
    expect(report.summary).toContain("- fr: [LOCALE_FAILED] locale failed");
    expect(report.exitStatus).toBe(1);
  });

  it("no summary with a clean exit (anomalous empty output, exit 0): no annotation, exitStatus 0", () => {
    const report = buildReport(null, 0, "");
    expect(report.annotations).toEqual([]);
    expect(report.exitStatus).toBe(0);
    expect(report.summary).toContain("verbatra run failed");
  });
});

describe("extractCliError and workflow-command escaping", () => {
  it("extracts {code,message} from the CLI stderr line", () => {
    expect(extractCliError("verbatra: error [CONFIG_INVALID] bad config")).toEqual({
      code: "CONFIG_INVALID",
      message: "bad config",
    });
    expect(extractCliError("some unrelated text")).toBeNull();
  });

  it("escapes %, newlines (data) and ':' (property) in annotations", () => {
    const s = summary({
      locales: [
        locale({
          locale: "x:y",
          status: "failed",
          error: { code: "C", message: "50% off\nline2" },
        }),
      ],
      failed: ["x:y"],
    });
    const report = buildReport(s, 1);
    expect(report.annotations[0]).toContain("verbatra%3A x%3Ay");
    expect(report.annotations[0]).toContain("50%25 off%0Aline2");
    expect(report.annotations[0]).not.toContain("\n");
  });
});
