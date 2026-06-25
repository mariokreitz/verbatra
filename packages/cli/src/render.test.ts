import type { WatchRunResult } from "@verbatra/sdk";
import { describe, expect, it } from "vitest";
import {
  renderError,
  renderExportHuman,
  renderExportJson,
  renderHuman,
  renderJson,
  renderRunResultHuman,
  renderRunResultNdjson,
  toRenderableError,
} from "./render.js";
import { makeLocale, makeSummary } from "./test-support.js";

describe("render: export result", () => {
  it("renders the path, one line per locale, and a total", () => {
    const text = renderExportHuman({
      path: "/p/wb.xlsx",
      locales: [
        { locale: "de", rows: 2 },
        { locale: "fr", rows: 3 },
      ],
    });
    expect(text).toContain("verbatra export -> /p/wb.xlsx");
    expect(text).toContain("de: 2 rows");
    expect(text).toContain("5 rows across 2 locales");
  });

  it("renders the export result as compact JSON", () => {
    const result = { path: "/p/wb.xlsx", locales: [{ locale: "de", rows: 1 }] };
    expect(JSON.parse(renderExportJson(result))).toEqual(result);
  });
});

describe("render: import reuses the summary formatter with an import header", () => {
  it("uses the import command label in the header", () => {
    const text = renderHuman(makeSummary({ locales: [makeLocale()] }), "import");
    expect(text).toContain("verbatra import");
  });
});

describe("render: human run summary", () => {
  it("renders one line per locale plus an aggregate", () => {
    const summary = makeSummary({
      locales: [makeLocale({ locale: "de", translated: ["a", "b"], unchanged: ["c"] })],
      succeeded: ["de"],
    });
    const text = renderHuman(summary);
    expect(text).toContain("de: 2 translated, 1 unchanged");
    expect(text).toContain("1 succeeded, 0 failed");
    expect(text).not.toContain("dry run");
  });

  it("marks a dry run and shows nothing-written in the aggregate", () => {
    const text = renderHuman(makeSummary({ dryRun: true }));
    expect(text).toContain("(dry run)");
    expect(text).toContain("dry run: nothing written");
  });

  it("shows optional counts only when non-zero", () => {
    const text = renderHuman(
      makeSummary({
        locales: [makeLocale({ orphaned: ["x"], notices: [], integrityMismatches: ["y"] })],
      }),
    );
    expect(text).toContain("1 orphaned");
    expect(text).toContain("1 integrity-withheld");
    expect(text).not.toContain("notices");
    expect(text).not.toContain("pruned"); // pruned is zero here, so the line is omitted
  });

  it("shows the generated count when plural forms were synthesized", () => {
    const text = renderHuman(
      makeSummary({
        locales: [makeLocale({ translated: ["a"], generated: ["items_few", "items_many"] })],
      }),
    );
    expect(text).toContain("2 generated");
  });

  it("omits the generated count when nothing was generated", () => {
    const text = renderHuman(makeSummary({ locales: [makeLocale({ translated: ["a"] })] }));
    expect(text).not.toContain("generated");
  });

  it("shows the pruned count when keys were pruned", () => {
    const text = renderHuman(
      makeSummary({
        locales: [makeLocale({ orphaned: ["x", "y"], pruned: ["x", "y"] })],
      }),
    );
    expect(text).toContain("2 orphaned");
    expect(text).toContain("2 pruned");
  });

  it("renders a failed locale with its structured code and message", () => {
    const text = renderHuman(
      makeSummary({
        locales: [
          makeLocale({
            locale: "fr",
            status: "failed",
            error: { code: "LOCALE_FAILED", message: "boom" },
          }),
        ],
        failed: ["fr"],
      }),
    );
    expect(text).toContain("fr: failed [LOCALE_FAILED] boom");
  });

  it("renders a failed locale without an error object (no bracketed suffix)", () => {
    const text = renderHuman(
      makeSummary({ locales: [makeLocale({ locale: "fr", status: "failed" })], failed: ["fr"] }),
    );
    expect(text).toContain("fr: failed");
    expect(text).not.toContain("[");
  });
});

describe("render: json and errors", () => {
  it("renderJson round-trips the summary", () => {
    const summary = makeSummary({ succeeded: ["de"] });
    expect(JSON.parse(renderJson(summary))).toEqual(summary);
  });

  it("renderError is a one-line structured message, never a stack", () => {
    expect(renderError({ code: "CONFIG_INVALID", message: "bad" })).toBe(
      "verbatra: error [CONFIG_INVALID] bad",
    );
  });

  it("toRenderableError reads a coded Error, falls back for non-coded and non-Error", () => {
    const coded = Object.assign(new Error("m"), { code: "SOURCE_UNREADABLE" });
    expect(toRenderableError(coded)).toEqual({ code: "SOURCE_UNREADABLE", message: "m" });
    expect(toRenderableError(new Error("plain"))).toEqual({ code: "CLI_ERROR", message: "plain" });
    expect(toRenderableError("weird")).toEqual({ code: "CLI_ERROR", message: "weird" });
  });
});

describe("render: watch run result", () => {
  it("NDJSON is the serialized result; human renders summary or error", () => {
    const ok: WatchRunResult = { status: "succeeded", summary: makeSummary({ succeeded: ["de"] }) };
    const bad: WatchRunResult = {
      status: "failed",
      error: { code: "SOURCE_INVALID", message: "x" },
    };
    expect(JSON.parse(renderRunResultNdjson(ok))).toEqual(ok);
    expect(renderRunResultHuman(ok)).toContain("1 succeeded");
    expect(renderRunResultHuman(bad)).toBe("verbatra: error [SOURCE_INVALID] x");
  });

  it("carries the pruned count and keys in the watch NDJSON record", () => {
    const result: WatchRunResult = {
      status: "succeeded",
      summary: makeSummary({
        locales: [makeLocale({ orphaned: ["x"], pruned: ["x"] })],
        succeeded: ["de"],
      }),
    };
    const parsed = JSON.parse(renderRunResultNdjson(result)) as typeof result;
    expect(parsed.status).toBe("succeeded");
    if (parsed.status === "succeeded") {
      expect(parsed.summary.locales[0]?.pruned).toEqual(["x"]);
    }
  });
});
