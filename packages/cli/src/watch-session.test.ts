import type { WatchController } from "@verbatra/sdk";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { captureStreams, flush, makeConfig, recordingDeps } from "./test-support.js";
import type { WatchOptions } from "./watch-session.js";
import { runWatch } from "./watch-session.js";

function options(): WatchOptions {
  return { config: makeConfig(), cwd: "/proj", json: false };
}

describe("runWatch: stop handling", () => {
  // A failed stop must never surface as an unhandled rejection; assert the process never sees one.
  let unhandled: unknown[];
  const onUnhandled = (reason: unknown): void => {
    unhandled.push(reason);
  };

  beforeEach(() => {
    unhandled = [];
    process.on("unhandledRejection", onUnhandled);
  });

  afterEach(() => {
    process.off("unhandledRejection", onUnhandled);
  });

  it("a clean stop resolves 0 and renders the stopping notice", async () => {
    const { streams, err } = captureStreams();
    const { deps } = recordingDeps({
      watch: async () => ({ stop: async () => {} }) satisfies WatchController,
    });

    const session = runWatch(options(), deps, streams);
    await flush();
    session.requestStop();
    const code = await session.done;

    expect(code).toBe(0);
    expect(err()).toContain("stopping, finishing current run");
  });

  it("a rejected stop resolves 2, renders the error, and emits no unhandled rejection", async () => {
    const { streams, err } = captureStreams();
    const stopError = Object.assign(new Error("watcher close failed"), { code: "WATCH_CLOSE" });
    const { deps } = recordingDeps({
      watch: async () =>
        ({
          stop: async () => {
            throw stopError;
          },
        }) satisfies WatchController,
    });

    const session = runWatch(options(), deps, streams);
    await flush();
    session.requestStop();
    const code = await session.done;
    await flush();

    expect(code).toBe(2);
    expect(err()).toContain("WATCH_CLOSE");
    expect(err()).toContain("watcher close failed");
    expect(unhandled).toEqual([]);
  });

  it("a stop requested during startup that then rejects resolves 2 and renders the error", async () => {
    const { streams, err } = captureStreams();
    const stopError = Object.assign(new Error("close after startup"), { code: "WATCH_CLOSE" });
    let resolveWatch!: (c: WatchController) => void;
    const { deps } = recordingDeps({
      watch: () =>
        new Promise<WatchController>((resolve) => {
          resolveWatch = resolve;
        }),
    });

    const session = runWatch(options(), deps, streams);
    // Request the stop BEFORE the controller exists; it must be honored once watch() resolves.
    session.requestStop();
    resolveWatch({
      stop: async () => {
        throw stopError;
      },
    });
    const code = await session.done;
    await flush();

    expect(code).toBe(2);
    expect(err()).toContain("WATCH_CLOSE");
    expect(unhandled).toEqual([]);
  });

  it("a forced second stop resolves 130", async () => {
    const { streams } = captureStreams();
    const { deps } = recordingDeps({
      // A stop that never settles, so the first requestStop stays in flight.
      watch: async () => ({ stop: () => new Promise<void>(() => {}) }) satisfies WatchController,
    });

    const session = runWatch(options(), deps, streams);
    await flush();
    session.requestStop();
    session.requestStop();
    const code = await session.done;

    expect(code).toBe(130);
  });
});
