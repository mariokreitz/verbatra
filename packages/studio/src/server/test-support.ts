import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LoadedConfig, VerbatraConfig } from "@verbatra/sdk";
import { startStudioServer } from "./create-studio-server.js";
import type { StudioServer, StudioServerOptions } from "./types.js";

/** A valid base config for tests; override individual fields as needed. */
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

/** A real on-disk fixture project: a temp directory with a source locale file, plus its cleanup. */
export interface FixtureProject {
  readonly root: string;
  readonly config: VerbatraConfig;
  cleanup(): Promise<void>;
}

/**
 * Builds a real, on-disk fixture project: a temp directory with the source locale file written
 * under `locales/`. Always call `cleanup()`, typically in a `finally` or `afterEach`.
 *
 * @param overrides - Config fields to override on top of {@link baseStudioConfig}.
 * @param sourceEntries - Key-value entries written to the source locale file.
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

/** A loader over a {@link FixtureProject}'s config, with "override" provenance and no glossary. */
export function fixtureLoader(project: FixtureProject): () => Promise<LoadedConfig> {
  return async () => ({
    config: project.config,
    source: { kind: "override" },
    glossary: { source: "none" },
  });
}

/**
 * An in-memory loader for tests that start a server but never need a real project on disk.
 * Resolves the same base config every time; touches no file system.
 */
export function stubLoader(): () => Promise<LoadedConfig> {
  return async () => ({
    config: baseStudioConfig(),
    source: { kind: "override" },
    glossary: { source: "none" },
  });
}

/**
 * Extracts the session cookie from a successful bootstrap redirect (a GET to `?token=...`).
 *
 * @throws An `Error` when the response carries no Set-Cookie header.
 */
export async function authenticatedCookie(url: string, token: string): Promise<string> {
  const response = await fetch(`${url}?token=${token}`, { redirect: "manual" });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie === null) {
    throw new Error("expected a Set-Cookie header from bootstrap");
  }
  return setCookie.split(";")[0] ?? "";
}

/** Overrides for {@link withServer}; any {@link StudioServerOptions} field may be set. */
export type WithServerOptions = Partial<StudioServerOptions>;

/**
 * Starts a real server on an OS-assigned loopback port (`port: 0`) with a silent output sink and
 * the stub loader by default, runs `fn` with the server, and always closes it afterward, even
 * when `fn` throws.
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
