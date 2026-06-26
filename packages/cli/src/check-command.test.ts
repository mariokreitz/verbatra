import { describe, expect, it } from "vitest";
import { run } from "./run.js";
import { captureStreams, makeCheckSummary, recordingDeps } from "./test-support.js";

describe("run check: SDK delegation, rendering, and exit codes", () => {
  it("delegates to check with the resolved cwd and exits 0 when in sync", async () => {
    const summary = makeCheckSummary({
      inSync: true,
      locales: [{ locale: "de", missing: 0, stale: 0, upToDate: 5, inSync: true }],
    });
    const { deps, calls } = recordingDeps({ check: async () => summary });
    const cap = captureStreams();

    const code = await run(["check", "--cwd", "/proj"], deps, cap.streams);

    expect(code).toBe(0);
    expect(calls.check).toHaveLength(1);
    expect(calls.check[0]).toMatchObject({ cwd: "/proj" });
    expect(cap.out()).toContain("verbatra check");
    expect(cap.out()).toContain("de: 0 missing, 0 stale, 5 up-to-date (in sync)");
    expect(cap.out()).toContain("all locales in sync");
  });

  it("exits 1 when at least one locale is out of sync, still printing the report", async () => {
    const summary = makeCheckSummary({
      inSync: false,
      locales: [
        { locale: "de", missing: 3, stale: 1, upToDate: 120, inSync: false },
        { locale: "fr", missing: 0, stale: 0, upToDate: 124, inSync: true },
      ],
    });
    const { deps } = recordingDeps({ check: async () => summary });
    const cap = captureStreams();

    const code = await run(["check"], deps, cap.streams);

    expect(code).toBe(1);
    expect(cap.out()).toContain("de: 3 missing, 1 stale, 120 up-to-date (out of sync)");
    expect(cap.out()).toContain("fr: 0 missing, 0 stale, 124 up-to-date (in sync)");
    expect(cap.out()).toContain("out of sync (run verbatra translate to update)");
  });

  it("parses --locales into the SDK call", async () => {
    const { deps, calls } = recordingDeps();
    const cap = captureStreams();

    await run(["check", "--locales", "de, fr ,"], deps, cap.streams);

    expect(calls.check[0]).toMatchObject({ locales: ["de", "fr"] });
  });

  it("--json prints the check summary as one JSON line", async () => {
    const summary = makeCheckSummary({
      inSync: false,
      locales: [{ locale: "de", missing: 1, stale: 0, upToDate: 2, inSync: false }],
    });
    const { deps } = recordingDeps({ check: async () => summary });
    const cap = captureStreams();

    const code = await run(["check", "--json"], deps, cap.streams);

    expect(code).toBe(1);
    expect(JSON.parse(cap.out())).toEqual(summary);
  });

  it("forwards --config to loadConfig", async () => {
    const { deps, calls } = recordingDeps();
    const cap = captureStreams();

    await run(["check", "--config", "verbatra.config.ts"], deps, cap.streams);

    expect(calls.loadConfig[0]).toMatchObject({ configPath: "verbatra.config.ts" });
  });

  it("a whole-run error renders to stderr and exits 2 with clean stdout", async () => {
    const { deps } = recordingDeps({
      check: async () => {
        throw Object.assign(new Error("bad source"), { code: "SOURCE_INVALID" });
      },
    });
    const cap = captureStreams();

    const code = await run(["check"], deps, cap.streams);

    expect(code).toBe(2);
    expect(cap.err()).toContain("[SOURCE_INVALID]");
    expect(cap.out()).toBe("");
  });
});
