import type { LockWaitEvent, WatchRunResult } from "@verbatra/sdk";
import { describe, expect, it } from "vitest";
import {
  renderCheckHuman,
  renderCheckJson,
  renderDiffHuman,
  renderDiffJson,
  renderError,
  renderExportHuman,
  renderExportJson,
  renderHuman,
  renderJson,
  renderLockWait,
  renderLockWaitHuman,
  renderLockWaitJson,
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

describe("render: check summary", () => {
  it("renders a header, per-locale counts with an in-sync marker, and an overall line", () => {
    const text = renderCheckHuman({
      inSync: false,
      locales: [
        { locale: "de", missing: 3, stale: 1, upToDate: 120, inSync: false },
        { locale: "fr", missing: 0, stale: 0, upToDate: 124, inSync: true },
      ],
    });
    expect(text).toContain("verbatra check");
    expect(text).toContain("de: 3 missing, 1 stale, 120 up-to-date (out of sync)");
    expect(text).toContain("fr: 0 missing, 0 stale, 124 up-to-date (in sync)");
    expect(text).toContain("out of sync (run verbatra translate to update)");
  });

  it("renders the all-in-sync overall line when every locale is in sync", () => {
    const text = renderCheckHuman({
      inSync: true,
      locales: [{ locale: "de", missing: 0, stale: 0, upToDate: 2, inSync: true }],
    });
    expect(text).toContain("all locales in sync");
    expect(text).not.toContain("out of sync");
  });

  it("renders the check summary as compact JSON", () => {
    const summary = {
      inSync: false,
      locales: [{ locale: "de", missing: 1, stale: 0, upToDate: 2, inSync: false }],
    };
    expect(JSON.parse(renderCheckJson(summary))).toEqual(summary);
  });
});

describe("render: diff summary", () => {
  it("renders a header, a per-locale count header, and the grouped key lists", () => {
    const text = renderDiffHuman({
      hasPendingChanges: true,
      locales: [
        {
          locale: "de",
          missing: ["app.title", "nav.home"],
          changed: ["footer.copyright"],
          orphaned: ["legacy.banner"],
          hasPendingChanges: true,
        },
      ],
    });
    expect(text).toContain("verbatra diff");
    expect(text).toContain("de: 2 to add, 1 to re-translate, 1 orphaned");
    expect(text).toContain("add:");
    expect(text).toContain("app.title, nav.home");
    expect(text).toContain("re-translate:");
    expect(text).toContain("footer.copyright");
    expect(text).toContain("orphaned:");
    expect(text).toContain("legacy.banner");
    expect(text).toContain("1 locale, pending changes");
  });

  it("omits empty groups and lists every key without truncation", () => {
    const many = Array.from({ length: 60 }, (_, i) => `k${i}`);
    const text = renderDiffHuman({
      hasPendingChanges: true,
      locales: [
        { locale: "de", missing: many, changed: [], orphaned: [], hasPendingChanges: true },
      ],
    });
    expect(text).toContain("de: 60 to add, 0 to re-translate, 0 orphaned");
    expect(text).toContain("add:");
    expect(text).not.toContain("re-translate:");
    expect(text).not.toContain("orphaned:");
    for (const key of many) {
      expect(text).toContain(key);
    }
  });

  it("collapses a locale with no missing, changed, or orphaned keys to one line", () => {
    const text = renderDiffHuman({
      hasPendingChanges: false,
      locales: [{ locale: "fr", missing: [], changed: [], orphaned: [], hasPendingChanges: false }],
    });
    expect(text).toContain("fr: no pending changes");
    expect(text).toContain("1 locale, no pending changes");
    expect(text).not.toContain("add:");
  });

  it("shows orphaned-only locales without collapsing and trailer stays no pending changes", () => {
    const text = renderDiffHuman({
      hasPendingChanges: false,
      locales: [
        {
          locale: "de",
          missing: [],
          changed: [],
          orphaned: ["legacy.banner"],
          hasPendingChanges: false,
        },
      ],
    });
    expect(text).toContain("de: 0 to add, 0 to re-translate, 1 orphaned");
    expect(text).toContain("orphaned:");
    expect(text).toContain("legacy.banner");
    expect(text).toContain("1 locale, no pending changes");
  });

  it("renders the diff summary as compact JSON", () => {
    const summary = {
      hasPendingChanges: true,
      locales: [
        {
          locale: "de",
          missing: ["a"],
          changed: [],
          orphaned: [],
          hasPendingChanges: true,
        },
      ],
    };
    expect(JSON.parse(renderDiffJson(summary))).toEqual(summary);
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
    expect(text).toContain("1 succeeded, 0 partial, 0 failed");
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
    expect(text).not.toContain("pruned");
  });

  it("shows the needs-review count when the run flagged keys for review", () => {
    const text = renderHuman(
      makeSummary({
        locales: [
          makeLocale({
            translated: ["a"],
            needsReview: [{ key: "a", reasons: ["EQUALS_SOURCE"] }],
          }),
        ],
      }),
    );
    expect(text).toContain("1 needs-review");
  });

  it("omits the needs-review count when nothing was flagged", () => {
    const text = renderHuman(makeSummary({ locales: [makeLocale({ translated: ["a"] })] }));
    expect(text).not.toContain("needs-review");
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

  it("shows the budget-withheld count only when non-zero", () => {
    const withheld = renderHuman(
      makeSummary({ locales: [makeLocale({ budgetWithheld: ["a", "b"] })] }),
    );
    expect(withheld).toContain("2 budget-withheld");

    const none = renderHuman(makeSummary({ locales: [makeLocale()] }));
    expect(none).not.toContain("budget-withheld");
  });

  it("shows per-locale token counts when usage is present, and omits them when absent", () => {
    const withUsage = renderHuman(
      makeSummary({
        locales: [makeLocale({ usage: { inputTokens: 100, outputTokens: 50 } })],
      }),
    );
    expect(withUsage).toContain("150 tokens (100 in, 50 out)");

    const withoutUsage = renderHuman(makeSummary({ locales: [makeLocale()] }));
    expect(withoutUsage).not.toContain("tokens");
  });

  it("shows a run-aggregate token line when RunSummary.usage is defined", () => {
    const text = renderHuman(
      makeSummary({
        locales: [makeLocale({ usage: { inputTokens: 100, outputTokens: 50 } })],
        usage: { inputTokens: 100, outputTokens: 50 },
      }),
    );
    expect(text).toContain("total: 150 tokens (100 in, 50 out)");
  });

  it("omits the run-aggregate token line when RunSummary.usage is absent", () => {
    const text = renderHuman(makeSummary({ locales: [makeLocale()] }));
    expect(text).not.toContain("total:");
  });

  it("shows a budget line with the ceiling, tokens used, and exceeded status", () => {
    const exceeded = renderHuman(
      makeSummary({
        budget: {
          maxTokens: 1000,
          behavior: "stop",
          supported: true,
          tokensUsed: 1200,
          exceeded: true,
        },
      }),
    );
    expect(exceeded).toContain("budget: 1200/1000 tokens (stop), exceeded");

    const withinBudget = renderHuman(
      makeSummary({
        budget: {
          maxTokens: 1000,
          behavior: "warn",
          supported: true,
          tokensUsed: 200,
          exceeded: false,
        },
      }),
    );
    expect(withinBudget).toContain("budget: 200/1000 tokens (warn), within budget");
  });

  it("renders the supported: false case as an explicit inert guardrail, not silently omitted", () => {
    const text = renderHuman(
      makeSummary({
        budget: {
          maxTokens: 500,
          behavior: "warn",
          supported: false,
          tokensUsed: 0,
          exceeded: false,
        },
      }),
    );
    expect(text).toContain("budget: 500 tokens configured (warn)");
    expect(text).toContain("not supported by this provider");
  });

  it("omits the budget line entirely when no budget is configured", () => {
    const text = renderHuman(makeSummary({ locales: [makeLocale()] }));
    expect(text).not.toContain("budget:");
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

describe("render: lock-wait progress", () => {
  it("human line names the path, holder pid and time, waited seconds, and the delete hint", () => {
    const event: LockWaitEvent = {
      lockPath: "/proj/.verbatra-local/locks/de.lock",
      elapsedMs: 2_400,
      holder: { pid: 4321, acquiredAt: "2026-07-18T00:00:00.000Z" },
    };
    const line = renderLockWaitHuman(event);
    expect(line).toContain("/proj/.verbatra-local/locks/de.lock");
    expect(line).toContain("held by pid 4321 since 2026-07-18T00:00:00.000Z");
    expect(line).toContain("waited 2s");
    expect(line).toContain("can be deleted");
  });

  it("human line omits the held-by clause when no holder is known", () => {
    const line = renderLockWaitHuman({ lockPath: "/x/de.lock", elapsedMs: 0 });
    expect(line).not.toContain("held");
    expect(line).toContain("/x/de.lock");
  });

  it("human line shows only the pid, or only the time, when the holder is partial", () => {
    const pidOnly = renderLockWaitHuman({
      lockPath: "/x/de.lock",
      elapsedMs: 0,
      holder: { pid: 7 },
    });
    expect(pidOnly).toContain("held by pid 7)");
    const timeOnly = renderLockWaitHuman({
      lockPath: "/x/de.lock",
      elapsedMs: 0,
      holder: { acquiredAt: "2026-07-18T00:00:00.000Z" },
    });
    expect(timeOnly).toContain("held since 2026-07-18T00:00:00.000Z)");
  });

  it("json record is a single object tagged lock-wait carrying the event fields", () => {
    const event: LockWaitEvent = {
      lockPath: "/x/de.lock",
      elapsedMs: 1_000,
      holder: { pid: 9 },
    };
    expect(JSON.parse(renderLockWaitJson(event))).toEqual({ type: "lock-wait", ...event });
  });

  it("renderLockWait dispatches to JSON under json mode and to the human line otherwise", () => {
    const event: LockWaitEvent = { lockPath: "/x/de.lock", elapsedMs: 0 };
    expect(JSON.parse(renderLockWait(event, true))).toMatchObject({ type: "lock-wait" });
    expect(renderLockWait(event, false)).toContain("waiting for the write lock");
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
