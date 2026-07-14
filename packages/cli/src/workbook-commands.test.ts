import { describe, expect, it } from "vitest";
import { run, runImport } from "./run.js";
import {
  captureStreams,
  makeExportResult,
  makeLocale,
  makeSummary,
  recordingDeps,
} from "./test-support.js";

describe("run export: SDK delegation and rendering", () => {
  it("delegates to exportWorkbook with resolved cwd and renders the path and counts", async () => {
    const result = makeExportResult({
      path: "/proj/verbatra-translations.xlsx",
      locales: [{ locale: "de", rows: 3 }],
    });
    const { deps, calls } = recordingDeps({ exportWorkbook: async () => result });
    const cap = captureStreams();

    const code = await run(["export", "--cwd", "/proj"], deps, cap.streams);

    expect(code).toBe(0);
    expect(calls.exportWorkbook).toHaveLength(1);
    expect(calls.exportWorkbook[0]).toMatchObject({ cwd: "/proj" });
    expect(cap.out()).toContain("verbatra export -> /proj/verbatra-translations.xlsx");
    expect(cap.out()).toContain("de: 3 rows");
  });

  it("parses --out, --locales, and --include-unchanged into the SDK call", async () => {
    const { deps, calls } = recordingDeps();
    const cap = captureStreams();

    await run(
      ["export", "--out", "wb.xlsx", "--locales", "de, fr ,", "--include-unchanged"],
      deps,
      cap.streams,
    );

    expect(calls.exportWorkbook[0]).toMatchObject({
      out: "wb.xlsx",
      locales: ["de", "fr"],
      includeUnchanged: true,
    });
  });

  it("--json prints the export result as one JSON line", async () => {
    const result = makeExportResult({ path: "/p/wb.xlsx", locales: [{ locale: "de", rows: 1 }] });
    const { deps } = recordingDeps({ exportWorkbook: async () => result });
    const cap = captureStreams();

    await run(["export", "--json"], deps, cap.streams);

    expect(JSON.parse(cap.out())).toEqual(result);
  });

  it("a whole-run error renders to stderr and exits 2", async () => {
    const { deps } = recordingDeps({
      loadConfig: async () => {
        throw Object.assign(new Error("no config"), { code: "CONFIG_NOT_FOUND" });
      },
    });
    const cap = captureStreams();

    const code = await run(["export"], deps, cap.streams);

    expect(code).toBe(2);
    expect(cap.err()).toContain("[CONFIG_NOT_FOUND]");
    expect(cap.out()).toBe("");
  });

  it("rejects an empty --locales list as a usage error: exit 2, stderr, clean stdout, no SDK call", async () => {
    const { deps, calls } = recordingDeps();
    const cap = captureStreams();

    const code = await run(["export", "--locales", ""], deps, cap.streams);

    expect(code).toBe(2);
    expect(cap.err()).toContain("[INVALID_LOCALES]");
    expect(cap.out()).toBe("");
    expect(calls.exportWorkbook).toHaveLength(0);
  });

  it("rejects a comma-only --locales list as a usage error", async () => {
    const { deps, calls } = recordingDeps();
    const cap = captureStreams();

    const code = await run(["export", "--locales", ","], deps, cap.streams);

    expect(code).toBe(2);
    expect(cap.err()).toContain("[INVALID_LOCALES]");
    expect(cap.out()).toBe("");
    expect(calls.exportWorkbook).toHaveLength(0);
  });

  it("passes an unknown but non-empty --locales through, and the SDK UNKNOWN_LOCALE exits 2", async () => {
    const { deps, calls } = recordingDeps({
      exportWorkbook: async () => {
        throw Object.assign(new Error("Requested locale not in configured targets: fr."), {
          code: "UNKNOWN_LOCALE",
        });
      },
    });
    const cap = captureStreams();

    const code = await run(["export", "--locales", "fr"], deps, cap.streams);

    expect(code).toBe(2);
    expect(calls.exportWorkbook[0]).toMatchObject({ locales: ["fr"] });
    expect(cap.err()).toContain("[UNKNOWN_LOCALE]");
    expect(cap.out()).toBe("");
  });
});

describe("run import: SDK delegation and rendering", () => {
  it("delegates to importWorkbook with the workbook arg and renders the summary as import", async () => {
    const summary = makeSummary({
      locales: [makeLocale({ translated: ["a"] })],
      succeeded: ["de"],
    });
    const { deps, calls } = recordingDeps({ importWorkbook: async () => summary });
    const cap = captureStreams();

    const code = await run(["import", "translations.xlsx"], deps, cap.streams);

    expect(code).toBe(0);
    expect(calls.importWorkbook[0]).toMatchObject({ workbook: "translations.xlsx" });
    expect(cap.out()).toContain("verbatra import");
    expect(cap.out()).toContain("de: 1 translated");
  });

  it("--dry-run passes dryRun:true", async () => {
    const { deps, calls } = recordingDeps();
    const cap = captureStreams();

    await run(["import", "wb.xlsx", "--dry-run"], deps, cap.streams);

    expect(calls.importWorkbook[0]).toMatchObject({ workbook: "wb.xlsx", dryRun: true });
  });

  it("exits 1 when a locale failed (same rule as translate)", async () => {
    const summary = makeSummary({
      locales: [makeLocale({ status: "failed", error: { code: "CONFIG_INVALID", message: "x" } })],
      failed: ["es"],
    });
    const { deps } = recordingDeps({ importWorkbook: async () => summary });
    const cap = captureStreams();

    const code = await run(["import", "wb.xlsx"], deps, cap.streams);

    expect(code).toBe(1);
  });

  it("a whole-run error renders to stderr and exits 2", async () => {
    const { deps } = recordingDeps({
      importWorkbook: async () => {
        throw Object.assign(new Error("bad workbook"), { code: "SOURCE_INVALID" });
      },
    });
    const cap = captureStreams();

    const code = await run(["import", "wb.xlsx"], deps, cap.streams);

    expect(code).toBe(2);
    expect(cap.err()).toContain("[SOURCE_INVALID]");
  });

  // importOptsSchema's fields are all optional strings/booleans, which real commander argv always
  // produces correctly, so no CLI flag can organically trigger a ZodError here. runImport is exported
  // so this test can call it directly with a malformed rawOpts, proving importOptsSchema.parse now
  // runs inside the error scaffold (it used to sit outside any try, risking an unhandled rethrow).
  it("a malformed rawOpts renders a structured error and exits 2, never throws", async () => {
    const { deps, calls } = recordingDeps();
    const cap = captureStreams();

    const code = await runImport("wb.xlsx", { cwd: 123 }, deps, cap.streams);

    expect(code).toBe(2);
    expect(cap.out()).toBe("");
    expect(cap.err()).not.toBe("");
    expect(calls.loadConfig).toHaveLength(0);
  });
});
