import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LoadedConfig, VerbatraConfig } from "@verbatra/sdk";
import { startStudioServer } from "./create-studio-server.js";
import type { StudioServer, StudioServerOptions } from "./types.js";

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

export interface FixtureProject {
  readonly root: string;
  readonly config: VerbatraConfig;
  cleanup(): Promise<void>;
}

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

export function fixtureLoader(project: FixtureProject): () => Promise<LoadedConfig> {
  return async () => ({
    config: project.config,
    source: { kind: "override" },
    glossary: { source: "none" },
  });
}

export function stubLoader(): () => Promise<LoadedConfig> {
  return async () => ({
    config: baseStudioConfig(),
    source: { kind: "override" },
    glossary: { source: "none" },
  });
}

export async function authenticatedCookie(url: string, token: string): Promise<string> {
  const response = await fetch(`${url}?token=${token}`, { redirect: "manual" });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie === null) {
    throw new Error("expected a Set-Cookie header from bootstrap");
  }
  return setCookie.split(";")[0] ?? "";
}

export type WithServerOptions = Partial<StudioServerOptions>;

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
