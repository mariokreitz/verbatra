import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SdkError, type WatchController } from "@verbatra/sdk";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { run } from "./run.js";
import {
  captureStreams,
  flush,
  makeConfig,
  makeLocale,
  makeSummary,
  recordingDeps,
} from "./test-support.js";
import type { WatchSession } from "./types.js";

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
    expect(calls.translate[0]).toEqual({ config: cfg, cwd: process.cwd() }); // resolved cwd, no dryRun
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

    expect(calls.loadConfig[0]).toEqual({ cwd: process.cwd() });
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

describe("run: .env loading is wired before the SDK flow", () => {
  let dir: string;
  let savedEnv: NodeJS.ProcessEnv;
  const TKEY = "VERBATRA_RUNTEST_T";
  const WKEY = "VERBATRA_RUNTEST_W";

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "verbatra-run-env-"));
    savedEnv = { ...process.env };
    delete process.env[TKEY];
    delete process.env[WKEY];
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in savedEnv)) {
        delete process.env[key];
      }
    }
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value !== undefined) {
        process.env[key] = value;
      }
    }
    rmSync(dir, { recursive: true, force: true });
  });

  it("translate loads .env from the --cwd directory before calling the SDK", async () => {
    writeFileSync(join(dir, ".env"), `${TKEY}=valT\n`);
    let seen: string | undefined;
    const { deps } = recordingDeps({
      translate: async () => {
        seen = process.env[TKEY];
        return makeSummary({ succeeded: ["de"] });
      },
    });

    const code = await run(["translate", "--cwd", dir], deps, captureStreams().streams);

    expect(code).toBe(0);
    expect(seen).toBe("valT");
  });

  it("watch loads .env from the --cwd directory before calling the SDK", async () => {
    writeFileSync(join(dir, ".env"), `${WKEY}=valW\n`);
    let seen: string | undefined;
    let resolveStop: (() => void) | undefined;
    const { deps } = recordingDeps({
      watch: () => {
        seen = process.env[WKEY];
        return Promise.resolve({
          stop: () =>
            new Promise<void>((resolve) => {
              resolveStop = resolve;
            }),
        } satisfies WatchController);
      },
    });

    let session: WatchSession | undefined;
    const done = run(["watch", "--cwd", dir], deps, captureStreams().streams, {
      onWatchSession: (s) => {
        session = s;
      },
    });
    await flush();
    session?.requestStop();
    resolveStop?.();

    expect(await done).toBe(0);
    expect(seen).toBe("valW");
  });
});

describe("run: init command", () => {
  it("dispatches init and scaffolds files non-interactively", async () => {
    const dir = mkdtempSync(join(tmpdir(), "verbatra-init-run-"));
    try {
      const { deps } = recordingDeps();
      const code = await run(
        ["init", "--yes", "--provider", "deepl", "--cwd", dir],
        deps,
        captureStreams().streams,
      );
      expect(code).toBe(0);
      expect(existsSync(join(dir, "verbatra.config.ts"))).toBe(true);
      expect(existsSync(join(dir, ".env.example"))).toBe(true);
      expect(existsSync(join(dir, ".gitignore"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
