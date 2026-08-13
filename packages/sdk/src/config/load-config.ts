import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { cosmiconfig } from "cosmiconfig";
import { TypeScriptLoader } from "cosmiconfig-typescript-loader";
import type { z } from "zod";
import { errorMessage, SdkError } from "../errors.js";
import { defaultFs, type SdkFs } from "../fs.js";
import { type GlossaryProvenance, resolveGlossary } from "./resolve-glossary.js";
import { type VerbatraConfig, type VerbatraConfigInput, verbatraConfigSchema } from "./schema.js";

const MODULE_NAME = "verbatra";

const SEARCH_PLACES = [
  "package.json",
  `.${MODULE_NAME}rc`,
  `.${MODULE_NAME}rc.json`,
  `.${MODULE_NAME}rc.yaml`,
  `.${MODULE_NAME}rc.yml`,
  `.${MODULE_NAME}rc.js`,
  `.${MODULE_NAME}rc.cjs`,
  `.${MODULE_NAME}rc.ts`,
  `${MODULE_NAME}.config.js`,
  `${MODULE_NAME}.config.cjs`,
  `${MODULE_NAME}.config.ts`,
];

export interface LoadConfigOptions {
  readonly cwd?: string;
  readonly configOverride?: unknown;
  readonly configPath?: string;
  readonly fs?: SdkFs;
}

export type ConfigSource =
  | { readonly kind: "search" | "explicit"; readonly filepath: string }
  | { readonly kind: "override" };

export interface LoadedConfig {
  readonly config: VerbatraConfig;
  readonly source: ConfigSource;
  readonly glossary: GlossaryProvenance;
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      const base = path.length > 0 ? `${path}: ${issue.message}` : issue.message;
      return issue.code === "unrecognized_keys"
        ? `${base} (API keys are read from the environment, not the config)`
        : base;
    })
    .join("; ");
}

function parseConfig(input: unknown): VerbatraConfigInput {
  const parsed = verbatraConfigSchema.safeParse(input);
  if (!parsed.success) {
    throw new SdkError(
      "CONFIG_INVALID",
      `The verbatra configuration is invalid: ${formatIssues(parsed.error)}`,
    );
  }
  return parsed.data;
}

async function finalizeConfig(
  parsed: VerbatraConfigInput,
  baseDir: string,
  fs: SdkFs,
): Promise<{ config: VerbatraConfig; glossary: GlossaryProvenance }> {
  const { glossary: glossaryInput, ...rest } = parsed;
  const resolved = await resolveGlossary(glossaryInput, baseDir, fs);
  const config: VerbatraConfig = {
    ...rest,
    ...(resolved.glossary !== undefined ? { glossary: resolved.glossary } : {}),
  };
  return { config, glossary: resolved.provenance };
}

async function loadExplicitWithMeta(
  explorer: ReturnType<typeof cosmiconfig>,
  configPath: string,
  cwd: string | undefined,
  fs: SdkFs,
): Promise<LoadedConfig> {
  const resolved = resolve(cwd ?? process.cwd(), configPath);
  if (!existsSync(resolved)) {
    throw new SdkError("CONFIG_NOT_FOUND", `No verbatra configuration file at ${resolved}.`);
  }

  let result: Awaited<ReturnType<typeof explorer.load>>;
  try {
    result = await explorer.load(resolved);
  } catch (error) {
    const detail = errorMessage(error);
    throw new SdkError("CONFIG_INVALID", `Failed to load the verbatra configuration: ${detail}`);
  }

  const parsed = parseConfig(result?.config);
  const { config, glossary } = await finalizeConfig(parsed, dirname(resolved), fs);
  return { config, source: { kind: "explicit", filepath: resolved }, glossary };
}

export async function loadConfigWithMeta(options: LoadConfigOptions = {}): Promise<LoadedConfig> {
  const fs = options.fs ?? defaultFs;

  if (options.configOverride !== undefined) {
    const parsed = parseConfig(options.configOverride);
    const { config, glossary } = await finalizeConfig(parsed, options.cwd ?? process.cwd(), fs);
    return { config, source: { kind: "override" }, glossary };
  }

  const explorer = cosmiconfig(MODULE_NAME, {
    searchPlaces: SEARCH_PLACES,
    loaders: { ".ts": TypeScriptLoader() },
  });

  if (options.configPath !== undefined) {
    return loadExplicitWithMeta(explorer, options.configPath, options.cwd, fs);
  }

  let result: Awaited<ReturnType<typeof explorer.search>>;
  try {
    result = await explorer.search(options.cwd);
  } catch (error) {
    const detail = errorMessage(error);
    throw new SdkError("CONFIG_INVALID", `Failed to load the verbatra configuration: ${detail}`);
  }

  if (result === null || result.isEmpty === true) {
    throw new SdkError(
      "CONFIG_NOT_FOUND",
      "No verbatra configuration found. Create a verbatra.config.ts, a .verbatrarc.json, or a 'verbatra' property in package.json.",
    );
  }

  const parsed = parseConfig(result.config);
  const { config, glossary } = await finalizeConfig(parsed, dirname(result.filepath), fs);
  return { config, source: { kind: "search", filepath: result.filepath }, glossary };
}

export async function loadConfig(options: LoadConfigOptions = {}): Promise<VerbatraConfig> {
  const { config } = await loadConfigWithMeta(options);
  return config;
}
