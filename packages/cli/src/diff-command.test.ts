import { describe, expect, it } from "vitest";
import { run } from "./run.js";
import { captureStreams, makeDiffSummary, recordingDeps } from "./test-support.js";

describe("run diff: SDK delegation, rendering, and exit codes", () => {
  it("delegates to diff with the resolved cwd and exits 0 when nothing is pending", async () => {
    const summary = makeDiffSummary({
      hasPendingChanges: false,
      locales: [{ locale: "de", missing: [], changed: [], orphaned: [], hasPendingChanges: false }],
    });
    const { deps, calls } = recordingDeps({ diff: async () => summary });
    const cap = captureStreams();

    const code = await run(["diff", "--cwd", "/proj"], deps, cap.streams);

    expect(code).toBe(0);
    expect(calls.diff).toHaveLength(1);
    expect(calls.diff[0]).toMatchObject({ cwd: "/proj" });
    expect(cap.out()).toContain("verbatra diff");
    expect(cap.out()).toContain("de: no pending changes");
    expect(cap.out()).toContain("1 locale, no pending changes");
  });

  it("exits 1 when a locale has missing or changed keys, still printing the report", async () => {
    const summary = makeDiffSummary({
      hasPendingChanges: true,
      locales: [
        {
          locale: "de",
          missing: ["app.title"],
          changed: ["footer.copyright"],
          orphaned: ["legacy.banner"],
          hasPendingChanges: true,
        },
        { locale: "fr", missing: [], changed: [], orphaned: [], hasPendingChanges: false },
      ],
    });
    const { deps } = recordingDeps({ diff: async () => summary });
    const cap = captureStreams();

    const code = await run(["diff"], deps, cap.streams);

    expect(code).toBe(1);
    expect(cap.out()).toContain("de: 1 to add, 1 to re-translate, 1 orphaned");
    expect(cap.out()).toContain("app.title");
    expect(cap.out()).toContain("footer.copyright");
    expect(cap.out()).toContain("legacy.banner");
    expect(cap.out()).toContain("fr: no pending changes");
  });

  it("exits 0 when only orphaned keys are present (orphaned alone is not pending)", async () => {
    const summary = makeDiffSummary({
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
    const { deps } = recordingDeps({ diff: async () => summary });
    const cap = captureStreams();

    const code = await run(["diff"], deps, cap.streams);

    expect(code).toBe(0);
    expect(cap.out()).toContain("de: 0 to add, 0 to re-translate, 1 orphaned");
    expect(cap.out()).toContain("legacy.banner");
  });

  it("parses --locales into the SDK call", async () => {
    const { deps, calls } = recordingDeps();
    const cap = captureStreams();

    await run(["diff", "--locales", "de, fr ,"], deps, cap.streams);

    expect(calls.diff[0]).toMatchObject({ locales: ["de", "fr"] });
  });

  it("--json prints the diff summary as one JSON line and nothing else on stdout", async () => {
    const summary = makeDiffSummary({
      hasPendingChanges: true,
      locales: [
        { locale: "de", missing: ["a"], changed: [], orphaned: [], hasPendingChanges: true },
      ],
    });
    const { deps } = recordingDeps({ diff: async () => summary });
    const cap = captureStreams();

    const code = await run(["diff", "--json"], deps, cap.streams);

    expect(code).toBe(1);
    expect(JSON.parse(cap.out())).toEqual(summary);
  });

  it("forwards --config to loadConfig", async () => {
    const { deps, calls } = recordingDeps();
    const cap = captureStreams();

    await run(["diff", "--config", "verbatra.config.ts"], deps, cap.streams);

    expect(calls.loadConfig[0]).toMatchObject({ configPath: "verbatra.config.ts" });
  });

  it("a whole-run error renders to stderr and exits 2 with clean stdout", async () => {
    const { deps } = recordingDeps({
      diff: async () => {
        throw Object.assign(new Error("bad source"), { code: "SOURCE_INVALID" });
      },
    });
    const cap = captureStreams();

    const code = await run(["diff"], deps, cap.streams);

    expect(code).toBe(2);
    expect(cap.err()).toContain("[SOURCE_INVALID]");
    expect(cap.out()).toBe("");
  });
});
