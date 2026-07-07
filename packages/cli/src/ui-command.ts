import { randomBytes } from "node:crypto";
import { z } from "zod";
import { loadEnvFiles } from "./env.js";
import { renderError, toRenderableError } from "./render.js";
import type { CliDeps, Streams, UiSession } from "./types.js";

/** 32 bytes (256 bits) of randomness for the bootstrap token, well above the 128-bit floor. */
const TOKEN_BYTES = 32;

/**
 * The exact, ruled install hint: printed only when `@verbatra/ui` itself, not one of its own
 * dependencies, fails to resolve.
 */
const NOT_INSTALLED_HINT =
  "Verbatra Studio requires @verbatra/ui. Install it with: pnpm add -D @verbatra/ui";

// Matches the bare specifier "@verbatra/ui" quoted (Node quotes it with single quotes in practice;
// either quote character is accepted). Deliberately anchored on the quote characters so a message
// naming a transitive dependency of @verbatra/ui (which appears unquoted, as part of a file path
// like ".../node_modules/@verbatra/ui/dist/index.js") never matches.
const UI_SPECIFIER_PATTERN = /['"]@verbatra\/ui['"]/;

function isUiPackageMissing(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  return code === "ERR_MODULE_NOT_FOUND" && UI_SPECIFIER_PATTERN.test(error.message);
}

const uiOptsSchema = z.object({
  cwd: z.string().optional(),
  config: z.string().optional(),
  port: z.coerce.number().int().min(1).max(65535).optional(),
});

type UiOpts = z.infer<typeof uiOptsSchema>;

/** A CLI-local usage error for a malformed `--port` value; routed to exit 2 like an `SdkError`. */
class InvalidPortError extends Error {
  /** Stable, secret-free code read by {@link toRenderableError}; branch on this, not the message. */
  readonly code = "INVALID_PORT";

  constructor() {
    super("The --port option must be an integer between 1 and 65535.");
    this.name = "InvalidPortError";
  }
}

function parseUiOpts(rawOpts: unknown): UiOpts {
  const result = uiOptsSchema.safeParse(rawOpts);
  if (!result.success) {
    throw new InvalidPortError();
  }
  return result.data;
}

/** A resolved outcome of one startup step: either its value, or `undefined` after rendering the error. */
async function step<T>(
  action: () => Promise<T>,
  streams: Streams,
  hint: (error: unknown) => string | undefined,
): Promise<T | undefined> {
  try {
    return await action();
  } catch (error) {
    streams.err(`${hint(error) ?? renderError(toRenderableError(error))}\n`);
    return undefined;
  }
}

/** Builds a session already resolved to `code`; used by every early-failure return. */
function failed(code: number): UiSession {
  return { done: Promise.resolve(code), requestStop: () => {} };
}

/**
 * Wires a running server's shutdown to `requestStop`, mirroring the `watch` command's session
 * contract: the first call closes the server and resolves the exit code (`0` clean, `1` if closing
 * itself throws); a second call while the first is still in flight forces `130`.
 */
function watchForStop(
  server: { close(): Promise<void> },
  streams: Streams,
): { done: Promise<number>; requestStop: () => void } {
  let resolveDone!: (code: number) => void;
  const done = new Promise<number>((resolve) => {
    resolveDone = resolve;
  });
  let stopping = false;

  const requestStop = (): void => {
    if (stopping) {
      resolveDone(130);
      return;
    }
    stopping = true;
    void server
      .close()
      .then(() => resolveDone(0))
      .catch((error: unknown) => {
        streams.err(`${renderError(toRenderableError(error))}\n`);
        resolveDone(1);
      });
  };

  return { done, requestStop };
}

/**
 * Run the `ui` command: start Verbatra Studio, a local, read-only translation dashboard. A thin
 * sequence with no server or view logic of its own: load env, load the config, dynamically import
 * `@verbatra/ui`, start the server, print the ruled banner, then wire shutdown to `requestStop`.
 *
 * Ordering: env and config load before `@verbatra/ui` is ever imported, so a config error never
 * reaches the dynamic import or `startUiServer`.
 *
 * @param rawOpts - The commander-parsed options (`--cwd`, `--config`, `--port`).
 * @param deps - The injected `loadConfigWithMeta` and `importUi` seams.
 * @param streams - The stdout/stderr sink.
 * @returns A {@link UiSession}: `done` resolves the exit code; `requestStop` is wired to SIGINT/SIGTERM
 *   by the bin shim.
 */
export async function runUi(rawOpts: unknown, deps: CliDeps, streams: Streams): Promise<UiSession> {
  let opts: UiOpts;
  try {
    opts = parseUiOpts(rawOpts);
  } catch (error) {
    streams.err(`${renderError(toRenderableError(error))}\n`);
    return failed(2);
  }

  const cwd = opts.cwd ?? process.cwd();
  loadEnvFiles(cwd);

  const config = await step(
    () =>
      deps.loadConfigWithMeta({
        cwd,
        ...(opts.config !== undefined ? { configPath: opts.config } : {}),
      }),
    streams,
    () => undefined,
  );
  if (config === undefined) {
    return failed(2);
  }

  const ui = await step(
    () => deps.importUi(),
    streams,
    (error) => (isUiPackageMissing(error) ? NOT_INSTALLED_HINT : undefined),
  );
  if (ui === undefined) {
    return failed(2);
  }

  const token = randomBytes(TOKEN_BYTES).toString("hex");
  const server = await step(
    () =>
      ui.startUiServer({
        loader: () => Promise.resolve(config),
        token,
        // The command owns the one printed banner (the ruled string below); ui's own default output
        // sink would otherwise also print its own differently-worded banner, and per-request log
        // lines are not needed by this thin wrapper.
        output: () => {},
        ...(opts.port !== undefined ? { port: opts.port } : {}),
      }),
    streams,
    () => undefined,
  );
  if (server === undefined) {
    return failed(2);
  }

  streams.out(`Verbatra Studio running at ${server.url}?token=${token}\n`);

  return watchForStop(server, streams);
}
