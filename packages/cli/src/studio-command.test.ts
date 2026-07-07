import { SdkError } from "@verbatra/sdk";
import { describe, expect, it } from "vitest";
import { run } from "./run.js";
import { captureStreams, flush, makeStudioModule, recordingDeps } from "./test-support.js";
import type { RunHooks, StudioSession } from "./types.js";

/** A 64-hex-char string is what the command's own token generation always produces. */
const TOKEN_SHAPE = /[0-9a-f]{64}/;

function moduleNotFound(specifier: string, importedFrom = "/proj/index.js"): Error {
  return Object.assign(
    new Error(`Cannot find package '${specifier}' imported from ${importedFrom}`),
    {
      code: "ERR_MODULE_NOT_FOUND",
    },
  );
}

/** Captures the live session via onStudioSession so a success-path test can drive requestStop. */
function captureStudioSession(): { hooks: RunHooks; session: () => StudioSession | undefined } {
  let session: StudioSession | undefined;
  return {
    hooks: {
      onStudioSession: (s) => {
        session = s;
      },
    },
    session: () => session,
  };
}

describe("run studio: ordering", () => {
  it("a config load failure exits 2, renders the error, and never imports @verbatra/studio", async () => {
    const { deps, calls } = recordingDeps({
      loadConfigWithMeta: async () => {
        throw new SdkError("CONFIG_NOT_FOUND", "No verbatra configuration found.");
      },
    });
    const cap = captureStreams();
    const captured = captureStudioSession();

    const code = await run(["studio", "--cwd", "/proj"], deps, cap.streams, captured.hooks);

    expect(code).toBe(2);
    expect(cap.err()).toContain("CONFIG_NOT_FOUND");
    expect(calls.importStudio).toHaveLength(0);
    // A hook wired to an already-failed session has nothing to close; calling requestStop on it
    // is a harmless no-op.
    expect(() => captured.session()?.requestStop()).not.toThrow();
  });

  it("passes --config through as configPath and --cwd through as cwd", async () => {
    const { deps, calls } = recordingDeps();
    const cap = captureStreams();
    const captured = captureStudioSession();

    const donePromise = run(
      ["studio", "--cwd", "/proj", "--config", "verbatra.config.ts"],
      deps,
      cap.streams,
      captured.hooks,
    );
    await flush(20);
    captured.session()?.requestStop();
    await donePromise;

    expect(calls.loadConfigWithMeta).toEqual([{ cwd: "/proj", configPath: "verbatra.config.ts" }]);
  });

  it("passes the resolved --cwd through to startStudioServer, not the process's own cwd", async () => {
    const startCalls: Array<{ cwd: string | undefined }> = [];
    const { deps } = recordingDeps({
      importStudio: async () =>
        makeStudioModule({
          startStudioServer: async (options) => {
            startCalls.push({ cwd: options.cwd });
            return { url: "http://127.0.0.1:5849/", port: 5849, close: async () => {} };
          },
        }),
    });
    const cap = captureStreams();
    const captured = captureStudioSession();

    const donePromise = run(["studio", "--cwd", "/proj"], deps, cap.streams, captured.hooks);
    await flush();
    captured.session()?.requestStop();
    await donePromise;

    expect(startCalls).toEqual([{ cwd: "/proj" }]);
  });

  it("a CONFIG_INVALID failure also exits 2 without ever importing @verbatra/studio", async () => {
    const { deps, calls } = recordingDeps({
      loadConfigWithMeta: async () => {
        throw new SdkError("CONFIG_INVALID", "The verbatra configuration is invalid.");
      },
    });
    const cap = captureStreams();

    const code = await run(["studio"], deps, cap.streams);

    expect(code).toBe(2);
    expect(cap.err()).toContain("CONFIG_INVALID");
    expect(calls.importStudio).toHaveLength(0);
  });
});

describe("run studio: @verbatra/studio not installed", () => {
  it("prints the canonical install hint and exits 2 when the missing specifier is @verbatra/studio itself", async () => {
    const { deps } = recordingDeps({
      importStudio: async () => {
        throw moduleNotFound("@verbatra/studio");
      },
    });
    const cap = captureStreams();

    const code = await run(["studio"], deps, cap.streams);

    expect(code).toBe(2);
    expect(cap.err()).toContain(
      "Verbatra Studio requires @verbatra/studio. Install it with: pnpm add -D @verbatra/studio",
    );
  });

  it("never masks a resolution failure inside @verbatra/studio's own dependency graph as not-installed", async () => {
    // Realistic shape: studio itself resolved fine, but one of its own dependencies did not. The failed
    // specifier is "chokidar", quoted; "@verbatra/studio" appears too, but only unquoted, as part of the
    // importer's file path (its own installed location under node_modules). A pattern that matched
    // "@verbatra/studio" as a bare substring (rather than quote-anchored) would wrongly treat this as
    // studio itself missing, so this message is deliberately built to contain that unquoted occurrence.
    const importedFrom = "/proj/node_modules/@verbatra/studio/dist/server/create-studio-server.js";
    const { deps } = recordingDeps({
      importStudio: async () => {
        throw moduleNotFound("chokidar", importedFrom);
      },
    });
    const cap = captureStreams();

    const code = await run(["studio"], deps, cap.streams);

    expect(code).toBe(2);
    expect(cap.err()).toContain(importedFrom);
    expect(cap.err()).not.toContain("Install it with: pnpm add -D @verbatra/studio");
    expect(cap.err()).toContain("ERR_MODULE_NOT_FOUND");
    expect(cap.err()).toContain("chokidar");
  });

  it("never masks a non-Error throw from the dynamic import as not-installed", async () => {
    const { deps } = recordingDeps({
      importStudio: async () => {
        throw "unexpected dynamic import failure";
      },
    });
    const cap = captureStreams();

    const code = await run(["studio"], deps, cap.streams);

    expect(code).toBe(2);
    expect(cap.err()).not.toContain("Install it with: pnpm add -D @verbatra/studio");
    expect(cap.err()).toContain("unexpected dynamic import failure");
  });
});

describe("run studio: the default port comes from @verbatra/studio, never a literal in the cli", () => {
  it("omits the port key entirely from the startStudioServer options when --port is not given", async () => {
    const hasPortKey: boolean[] = [];
    const { deps } = recordingDeps({
      importStudio: async () =>
        makeStudioModule({
          startStudioServer: async (options) => {
            hasPortKey.push(Object.hasOwn(options, "port"));
            return { url: "http://127.0.0.1:5849/", port: 5849, close: async () => {} };
          },
        }),
    });
    const cap = captureStreams();
    const captured = captureStudioSession();

    const donePromise = run(["studio"], deps, cap.streams, captured.hooks);
    await flush();
    captured.session()?.requestStop();
    await donePromise;

    expect(hasPortKey).toEqual([false]);
  });
});

describe("run studio: --port validation", () => {
  it.each([
    "0",
    "65536",
    "3.5",
    "abc",
  ])("rejects an out-of-range or non-integer port %s, exiting 2 before loading the config", async (value) => {
    const { deps, calls } = recordingDeps();
    const cap = captureStreams();

    const code = await run(["studio", "--port", value], deps, cap.streams);

    expect(code).toBe(2);
    expect(calls.loadConfigWithMeta).toHaveLength(0);
    expect(calls.importStudio).toHaveLength(0);
  });

  it.each([
    "1",
    "65535",
  ])("accepts the boundary port %s and passes it through to startStudioServer", async (value) => {
    const startCalls: Array<{ port: number | undefined }> = [];
    const { deps } = recordingDeps({
      importStudio: async () =>
        makeStudioModule({
          startStudioServer: async (options) => {
            startCalls.push({ port: options.port });
            return {
              url: `http://127.0.0.1:${options.port}/`,
              port: options.port ?? 0,
              close: async () => {},
            };
          },
        }),
    });
    const cap = captureStreams();
    const captured = captureStudioSession();

    const donePromise = run(["studio", "--port", value], deps, cap.streams, captured.hooks);
    await flush();
    captured.session()?.requestStop();
    const code = await donePromise;

    expect(code).toBe(0);
    expect(startCalls).toEqual([{ port: Number(value) }]);
  });
});

describe("run studio: the loader passed to startStudioServer resolves the already-loaded config", () => {
  it("never re-invokes loadConfigWithMeta from inside the loader it hands to startStudioServer", async () => {
    let loaderResult: unknown;
    const { deps, calls } = recordingDeps({
      importStudio: async () =>
        makeStudioModule({
          startStudioServer: async (options) => {
            loaderResult = await options.loader();
            return { url: "http://127.0.0.1:5849/", port: 5849, close: async () => {} };
          },
        }),
    });
    const cap = captureStreams();
    const captured = captureStudioSession();

    const donePromise = run(["studio"], deps, cap.streams, captured.hooks);
    await flush(20);
    captured.session()?.requestStop();
    await donePromise;

    expect(calls.loadConfigWithMeta).toHaveLength(1);
    expect(loaderResult).toMatchObject({ config: { sourceLocale: "en" } });
  });
});

describe("run studio: failure output never leaks a URL or a token", () => {
  it("on a port-busy failure, the combined output has no URL and no token-shaped substring", async () => {
    const { deps } = recordingDeps({
      importStudio: async () =>
        makeStudioModule({
          startStudioServer: async () => {
            throw Object.assign(new Error("port 5849 is already in use"), {
              name: "StudioServerStartError",
              code: "PORT_IN_USE",
              port: 5849,
            });
          },
        }),
    });
    const cap = captureStreams();

    const code = await run(["studio"], deps, cap.streams);
    const combined = `${cap.out()}${cap.err()}`;

    expect(code).toBe(2);
    expect(combined).toContain("PORT_IN_USE");
    expect(combined).not.toMatch(/https?:\/\//);
    expect(combined).not.toMatch(TOKEN_SHAPE);
  });
});

describe("run studio: success path and shutdown", () => {
  it("prints the ruled banner with the token exactly once, then a clean stop exits 0", async () => {
    const { deps } = recordingDeps();
    const cap = captureStreams();
    const captured = captureStudioSession();

    const donePromise = run(["studio"], deps, cap.streams, captured.hooks);
    await flush();

    const out = cap.out();
    expect(out).toMatch(
      /^Verbatra Studio running at http:\/\/127\.0\.0\.1:\d+\/\?token=[0-9a-f]{64}\n$/,
    );
    expect(out.match(/token=/g)).toHaveLength(1);

    captured.session()?.requestStop();
    const code = await donePromise;
    expect(code).toBe(0);
  });

  it("a second requestStop while the first is closing forces exit 130", async () => {
    const { deps } = recordingDeps({
      importStudio: async () =>
        makeStudioModule({
          startStudioServer: async () => ({
            url: "http://127.0.0.1:5849/",
            port: 5849,
            close: () => new Promise(() => {}), // never resolves within this test
          }),
        }),
    });
    const cap = captureStreams();
    const captured = captureStudioSession();

    const donePromise = run(["studio"], deps, cap.streams, captured.hooks);
    await flush();
    const session = captured.session();
    session?.requestStop();
    session?.requestStop();
    const code = await donePromise;

    expect(code).toBe(130);
  });

  it("exits 1 and renders the error when closing the server itself fails", async () => {
    const { deps } = recordingDeps({
      importStudio: async () =>
        makeStudioModule({
          startStudioServer: async () => ({
            url: "http://127.0.0.1:5849/",
            port: 5849,
            close: async () => {
              throw Object.assign(new Error("close failed"), { code: "CLOSE_FAILED" });
            },
          }),
        }),
    });
    const cap = captureStreams();
    const captured = captureStudioSession();

    const donePromise = run(["studio"], deps, cap.streams, captured.hooks);
    await flush();
    captured.session()?.requestStop();
    const code = await donePromise;

    expect(code).toBe(1);
    expect(cap.err()).toContain("CLOSE_FAILED");
  });
});

describe("run studio: help text (Naming ruling)", () => {
  it("matches the ruled --help description exactly", async () => {
    const { deps } = recordingDeps();
    const cap = captureStreams();

    const code = await run(["studio", "--help"], deps, cap.streams);

    expect(code).toBe(0);
    expect(cap.out()).toContain("Start Verbatra Studio, the local translation dashboard");
  });
});
