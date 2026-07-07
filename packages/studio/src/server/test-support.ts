import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LoadedConfig, VerbatraConfig } from "@verbatra/sdk";
import { startStudioServer } from "./create-studio-server.js";
import type { StudioServer, StudioServerOptions } from "./types.js";

/** A valid base config for tests; mirrors the sdk's own `baseConfig` test fixture, override fields as needed. */
export function baseStudioConfig(overrides: Partial<VerbatraConfig> = {}): VerbatraConfig {
  return {
    sourceLocale: "en",
    targetLocales: ["de"],
    format: "i18next-json",
    files: { pattern: "locales/{locale}.json" },
    provider: { id: "anthropic", options: { model: "test-model", maxTokens: 256 } },
    ...overrides,
  };
}

/** A real on-disk fixture project: a temp directory with a source locale file, ready to be loaded. */
export interface FixtureProject {
  readonly root: string;
  readonly config: VerbatraConfig;
  cleanup(): Promise<void>;
}

/**
 * Builds a real, on-disk fixture project (mirrors the sdk's own `makeTempDir` test fixture
 * pattern): a temp directory with a source locale file under `locales/`, ready to load through a
 * loader or the sdk's own `check`/`diff`. Always call `cleanup()`, typically in a `finally` or
 * `afterEach`.
 */
export async function makeFixtureProject(
  overrides: Partial<VerbatraConfig> = {},
  sourceEntries: Readonly<Record<string, string>> = { greeting: "hello" },
): Promise<FixtureProject> {
  const root = await mkdtemp(join(tmpdir(), "verbatra-studio-fixture-"));
  const config = baseStudioConfig(overrides);
  await mkdir(join(root, "locales"), { recursive: true });
  await writeFile(
    join(root, "locales", `${config.sourceLocale}.json`),
    `${JSON.stringify(sourceEntries, null, 2)}\n`,
    "utf8",
  );
  return {
    root,
    config,
    cleanup: () => rm(root, { recursive: true, force: true }),
  };
}

/** A loader over a {@link FixtureProject}, with "override" provenance and no glossary, for injecting into {@link startStudioServer}. */
export function fixtureLoader(project: FixtureProject): () => Promise<LoadedConfig> {
  return async () => ({
    config: project.config,
    source: { kind: "override" },
    glossary: { source: "none" },
  });
}

/**
 * A trivial in-memory loader for tests that start a server but never call an RPC method needing a
 * real project on disk (transport, security-header, and auth tests). Resolves the same config
 * every time; touches no file system.
 */
export function stubLoader(): () => Promise<LoadedConfig> {
  return async () => ({
    config: baseStudioConfig(),
    source: { kind: "override" },
    glossary: { source: "none" },
  });
}

/** Extracts the session cookie from a successful bootstrap redirect (a GET to `?token=...`). */
export async function authenticatedCookie(url: string, token: string): Promise<string> {
  const response = await fetch(`${url}?token=${token}`, { redirect: "manual" });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie === null) {
    throw new Error("expected a Set-Cookie header from bootstrap");
  }
  return setCookie.split(";")[0] ?? "";
}

export type WithServerOptions = Partial<StudioServerOptions>;

/**
 * Starts a real server on an OS-assigned loopback port (`port: 0`) with an injected output sink
 * (silent by default) and an injectable `heartbeatIntervalMs`, runs `fn` with the server, and
 * always closes it afterward, even if `fn` throws. Every server test acquires its server this way;
 * no raw `createServer`/`listen` call belongs in a test file.
 */
export async function withServer<T>(
  fn: (server: StudioServer) => Promise<T>,
  options: WithServerOptions = {},
): Promise<T> {
  const server = await startStudioServer({
    ...options,
    port: 0,
    loader: options.loader ?? stubLoader(),
    output: options.output ?? ((): void => {}),
  });
  try {
    return await fn(server);
  } finally {
    await server.close();
  }
}
