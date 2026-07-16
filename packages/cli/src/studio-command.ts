import { randomBytes } from "node:crypto";
import { z } from "zod";
import { loadEnvFiles } from "./env.js";
import { renderError, toRenderableError } from "./render.js";
import type { CliDeps, Streams, StudioSession } from "./types.js";

/** 32 bytes (256 bits) of randomness for the bootstrap token, well above the 128-bit floor. */
const TOKEN_BYTES = 32;

/**
 * The exact, ruled install hint: printed only when `@verbatra/studio` itself, not one of its own
 * dependencies, fails to resolve.
 */
const NOT_INSTALLED_HINT =
  "Verbatra Studio requires @verbatra/studio. Install it with: pnpm add -D @verbatra/studio";

// Matches the bare specifier "@verbatra/studio" quoted (Node quotes it with single quotes in
// practice; either quote character is accepted). Deliberately anchored on the quote characters so a
// message naming a transitive dependency of @verbatra/studio (which appears unquoted, as part of a
// file path like ".../node_modules/@verbatra/studio/dist/index.js") never matches.
const STUDIO_SPECIFIER_PATTERN = /['"]@verbatra\/studio['"]/;

function isStudioPackageMissing(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  return code === "ERR_MODULE_NOT_FOUND" && STUDIO_SPECIFIER_PATTERN.test(error.message);
}

const studioOptsSchema = z.object({
  cwd: z.string().optional(),
  config: z.string().optional(),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  allowSpend: z.boolean().optional(),
});

type StudioOpts = z.infer<typeof studioOptsSchema>;

/** Environment variable fallback for the spend capability flag, read only when the CLI flag itself is absent. */
const ALLOW_SPEND_ENV_VAR = "VERBATRA_STUDIO_ALLOW_SPEND";

/** Env-var values that count as "on"; anything else (including unset) is "off". Case-insensitive. */
const TRUTHY_ENV_VALUES = new Set(["1", "true", "yes", "on"]);

function isEnvValueTruthy(value: string | undefined): boolean {
  return value !== undefined && TRUTHY_ENV_VALUES.has(value.trim().toLowerCase());
}

/**
 * Resolves the spend capability flag: the CLI flag wins when given; otherwise its environment
 * variable fallback; otherwise off. Never re-read after this call: the caller resolves the flag
 * once, before the config loader ever runs (G1-style ordering: the config loader executes the
 * project's own config module in-process, so nothing that module does can influence which
 * capabilities this process was granted), and passes the plain boolean through unchanged.
 * Spend is the only capability flag: local file editing is always on and needs no flag.
 */
function resolveSpendCapability(opts: StudioOpts): boolean {
  if (opts.allowSpend !== undefined) {
    return opts.allowSpend;
  }
  return isEnvValueTruthy(process.env[ALLOW_SPEND_ENV_VAR]);
}

/** A CLI-local usage error for a malformed `--port` value; routed to exit 2 like an `SdkError`. */
class InvalidPortError extends Error {
  /** Stable, secret-free code read by {@link toRenderableError}; branch on this, not the message. */
  readonly code = "INVALID_PORT";

  constructor() {
    super("The --port option must be an integer between 1 and 65535.");
    this.name = "InvalidPortError";
  }
}

function parseStudioOpts(rawOpts: unknown): StudioOpts {
  const result = studioOptsSchema.safeParse(rawOpts);
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
function failed(code: number): StudioSession {
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
 * Run the `studio` command: start Verbatra Studio, a local translation dashboard that can always
 * edit the project's own locale files but never calls a provider without `--allow-spend`. A thin
 * sequence with no server or view logic of its own: load env, resolve the spend capability, load
 * the config, dynamically import `@verbatra/studio`, start the server, print the ruled banner,
 * then wire shutdown to `requestStop`.
 *
 * Ordering: env loads, then the spend flag is resolved, before the config ever loads and before
 * `@verbatra/studio` is ever imported. `spend` is therefore fixed before `loadConfigWithMeta`
 * (and, with it, the project's own config module) ever executes, so nothing that module does can
 * influence which capabilities this process was granted; a config error never reaches the dynamic
 * import or `startStudioServer` either.
 *
 * @param rawOpts - The commander-parsed options (`--cwd`, `--config`, `--port`, `--allow-spend`).
 * @param deps - The injected `loadConfigWithMeta` and `importStudio` seams.
 * @param streams - The stdout/stderr sink.
 * @returns A {@link StudioSession}: `done` resolves the exit code; `requestStop` is wired to SIGINT/SIGTERM
 *   by the bin shim.
 */
export async function runStudio(
  rawOpts: unknown,
  deps: CliDeps,
  streams: Streams,
): Promise<StudioSession> {
  let opts: StudioOpts;
  try {
    opts = parseStudioOpts(rawOpts);
  } catch (error) {
    streams.err(`${renderError(toRenderableError(error))}\n`);
    return failed(2);
  }

  const cwd = opts.cwd ?? process.cwd();
  loadEnvFiles(cwd);
  const spend = resolveSpendCapability(opts);

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

  const studioModule = await step(
    () => deps.importStudio(),
    streams,
    (error) => (isStudioPackageMissing(error) ? NOT_INSTALLED_HINT : undefined),
  );
  if (studioModule === undefined) {
    return failed(2);
  }

  const token = randomBytes(TOKEN_BYTES).toString("hex");
  const server = await step(
    () =>
      studioModule.startStudioServer({
        loader: () => Promise.resolve(config),
        token,
        cwd,
        // The command owns the one printed banner (the ruled string below); the studio server's own
        // default output sink would otherwise also print its own differently-worded banner, and
        // per-request log lines are not needed by this thin wrapper.
        output: () => {},
        spend,
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
