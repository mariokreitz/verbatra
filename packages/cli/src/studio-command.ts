import { randomBytes } from "node:crypto";
import { z } from "zod";
import { CliUsageError } from "./cli-usage-error.js";
import { loadEnvFiles } from "./env.js";
import { renderError, toRenderableError } from "./render.js";
import { stoppableSession } from "./stoppable-session.js";
import type { CliDeps, Streams, StudioSession } from "./types.js";

const TOKEN_BYTES = 32;

const NOT_INSTALLED_HINT =
  "Verbatra Studio requires @verbatra/studio. Install it with: pnpm add -D @verbatra/studio";

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
  exposeAgentTools: z.boolean().optional(),
});

type StudioOpts = z.infer<typeof studioOptsSchema>;

const ALLOW_SPEND_ENV_VAR = "VERBATRA_STUDIO_ALLOW_SPEND";

const AGENT_TOOLS_ENV_VAR = "VERBATRA_STUDIO_AGENT_TOOLS";

const TRUTHY_ENV_VALUES = new Set(["1", "true", "yes", "on"]);

function isEnvValueTruthy(value: string | undefined): boolean {
  return value !== undefined && TRUTHY_ENV_VALUES.has(value.trim().toLowerCase());
}

function resolveSpendCapability(opts: StudioOpts): boolean {
  if (opts.allowSpend !== undefined) {
    return opts.allowSpend;
  }
  return isEnvValueTruthy(process.env[ALLOW_SPEND_ENV_VAR]);
}

function resolveExposeAgentTools(opts: StudioOpts): boolean {
  if (opts.exposeAgentTools !== undefined) {
    return opts.exposeAgentTools;
  }
  return isEnvValueTruthy(process.env[AGENT_TOOLS_ENV_VAR]);
}

const INVALID_PORT_MESSAGE = "The --port option must be an integer between 1 and 65535.";

function parseStudioOpts(rawOpts: unknown): StudioOpts {
  const result = studioOptsSchema.safeParse(rawOpts);
  if (!result.success) {
    throw new CliUsageError("INVALID_PORT", INVALID_PORT_MESSAGE);
  }
  return result.data;
}

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

function failed(code: number): StudioSession {
  return { done: Promise.resolve(code), requestStop: () => {} };
}

function watchForStop(server: { close(): Promise<void> }, streams: Streams): StudioSession {
  return stoppableSession({
    getController: () => Promise.resolve({ stop: () => server.close() }),
    onFailure: (error) => {
      streams.err(`${renderError(toRenderableError(error))}\n`);
      return 1;
    },
  });
}

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
  const exposeAgentTools = resolveExposeAgentTools(opts);

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
        output: () => {},
        spend,
        exposeAgentTools,
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
