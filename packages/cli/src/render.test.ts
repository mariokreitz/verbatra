import type { WatchRunResult } from "@verbatra/sdk";
import { describe, expect, it } from "vitest";
import {
  renderError,
  renderHuman,
  renderJson,
  renderRunResultHuman,
  renderRunResultNdjson,
  toRenderableError,
} from "./render.js";
import { makeLocale, makeSummary } from "./test-support.js";

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
});
