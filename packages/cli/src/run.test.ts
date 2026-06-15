import { readFileSync } from "node:fs";
import { SdkError } from "@verbatra/sdk";
import { describe, expect, it } from "vitest";
import { run } from "./run.js";
import {
  captureStreams,
  makeConfig,
  makeLocale,
  makeSummary,
  recordingDeps,
} from "./test-support.js";

describe("run translate: SDK delegation and rendering", () => {
  it("calls the SDK translate() with the resolved config and renders the summary human-readably", async () => {
    const cfg = makeConfig();
    const summary = makeSummary({
      locales: [makeLocale({ translated: ["a"] })],
      succeeded: ["de"],
    });
    const { deps, calls } = recordingDeps({
      loadConfig: async () => cfg,
      translate: async () => summary,
    });
    const cap = captureStreams();

    const code = await run(["translate"], deps, cap.streams);

    expect(code).toBe(0);
    expect(calls.translate).toHaveLength(1);
    expect(calls.translate[0]).toEqual({ config: cfg }); // no cwd, no dryRun
    expect(cap.out()).toContain("de: 1 translated");
    expect(cap.err()).toBe("");
  });

  it("--config passes configPath to loadConfig and --cwd feeds both loadConfig and translate", async () => {
    const { deps, calls } = recordingDeps();
    const cap = captureStreams();

    await run(["translate", "--config", "ci.json", "--cwd", "/proj"], deps, cap.streams);

    expect(calls.loadConfig[0]).toEqual({ cwd: "/proj", configPath: "ci.json" });
    expect(calls.translate[0]?.cwd).toBe("/proj");
  });

  it("without --config, loadConfig is called without configPath (search applies)", async () => {
    const { deps, calls } = recordingDeps();
    const cap = captureStreams();

    await run(["translate"], deps, cap.streams);

    expect(calls.loadConfig[0]).toEqual({});
    expect(calls.loadConfig[0]).not.toHaveProperty("configPath");
  });

  it("--dry-run passes dryRun:true and does a single translate call", async () => {
    // The stub echoes dryRun like the SDK does, since the CLI renders what the SDK returns.
    const { deps, calls } = recordingDeps({
      translate: async (input) => makeSummary({ dryRun: input.dryRun === true }),
    });
    const cap = captureStreams();

    const code = await run(["translate", "--dry-run"], deps, cap.streams);

    expect(calls.translate).toHaveLength(1);
    expect(calls.translate[0]?.dryRun).toBe(true);
    expect(cap.out()).toContain("dry run");
    expect(code).toBe(0);
  });

  it("--json emits only the RunSummary JSON on stdout, nothing else; stderr stays empty", async () => {
    const summary = makeSummary({ succeeded: ["de"] });
    const { deps } = recordingDeps({ translate: async () => summary });
    const cap = captureStreams();

    const code = await run(["translate", "--json"], deps, cap.streams);

    expect(code).toBe(0);
    expect(JSON.parse(cap.out().trim())).toEqual(summary); // stdout parses cleanly as the summary
    expect(cap.err()).toBe("");
  });
});

describe("run translate: exit codes", () => {
  it("all locales clean -> 0", async () => {
    const { deps } = recordingDeps({ translate: async () => makeSummary({ succeeded: ["de"] }) });
    expect(await run(["translate"], deps, captureStreams().streams)).toBe(0);
  });

  it("a per-locale failure -> 1", async () => {
    const summary = makeSummary({
      locales: [makeLocale({ status: "failed", error: { code: "LOCALE_FAILED", message: "x" } })],
      failed: ["de"],
    });
    const { deps } = recordingDeps({ translate: async () => summary });
    expect(await run(["translate"], deps, captureStreams().streams)).toBe(1);
  });

  it("a whole-run SdkError -> 2, structured error on stderr, stdout empty", async () => {
    const { deps } = recordingDeps({
      translate: async () => {
        throw new SdkError("SOURCE_UNREADABLE", "no source");
      },
    });
    const cap = captureStreams();

    const code = await run(["translate"], deps, cap.streams);

    expect(code).toBe(2);
    expect(cap.err()).toContain("[SOURCE_UNREADABLE] no source");
    expect(cap.out()).toBe("");
  });

  it("under --json a whole-run error leaves stdout EMPTY and the error on stderr", async () => {
    const { deps } = recordingDeps({
      loadConfig: async () => {
        throw new SdkError("CONFIG_INVALID", "bad config");
      },
    });
    const cap = captureStreams();

    const code = await run(["translate", "--json"], deps, cap.streams);

    expect(code).toBe(2);
    expect(cap.out()).toBe("");
    expect(cap.err()).toContain("[CONFIG_INVALID] bad config");
  });
});

describe("run: usage errors, help, version", () => {
  it("an unknown command -> 2", async () => {
    const { deps } = recordingDeps();
    expect(await run(["bogus"], deps, captureStreams().streams)).toBe(2);
  });

  it("an unknown flag -> 2", async () => {
    const { deps } = recordingDeps();
    expect(await run(["translate", "--nope"], deps, captureStreams().streams)).toBe(2);
  });

  it("--help and --version exit 0, and --version reports the package version", async () => {
    const { deps } = recordingDeps();
    expect(await run(["--help"], deps, captureStreams().streams)).toBe(0);

    const cap = captureStreams();
    expect(await run(["--version"], deps, cap.streams)).toBe(0);
    const raw = readFileSync(new URL("../package.json", import.meta.url), "utf8");
    const manifest = JSON.parse(raw) as { version: string };
    expect(cap.out().trim()).toBe(manifest.version);
  });
});
