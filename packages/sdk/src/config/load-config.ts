import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { cosmiconfig } from "cosmiconfig";
import { TypeScriptLoader } from "cosmiconfig-typescript-loader";
import type { z } from "zod";
import { SdkError } from "../errors.js";
import { defaultFs, type SdkFs } from "../fs.js";
import { type GlossaryProvenance, resolveGlossary } from "./resolve-glossary.js";
import { type VerbatraConfig, type VerbatraConfigInput, verbatraConfigSchema } from "./schema.js";

const MODULE_NAME = "verbatra";

/** Search places in cosmiconfig precedence order; the first found wins. */
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
  /** Directory to start the search from. Defaults to the current working directory. */
  readonly cwd?: string;
  /**
   * A pre-resolved config object (e.g. one passed in code) to validate instead of
   * searching the file system. Still validated with zod, exactly like a loaded file.
   */
  readonly configOverride?: unknown;
  /**
   * An explicit config file to load instead of searching. A relative path resolves against `cwd`; an
   * absolute path is used as given. Parsed and zod-validated exactly like a searched file: a missing
   * file is `CONFIG_NOT_FOUND`, a present but invalid one is `CONFIG_INVALID`. Takes precedence over
   * search, but `configOverride` takes precedence over it.
   */
  readonly configPath?: string;
  /** The file-system seam a glossary file path is read through. Defaults to {@link defaultFs}. */
  readonly fs?: SdkFs;
}

/** Where the loaded config came from: an in-memory override, one explicit file, or a search result. */
export type ConfigSource =
  | { readonly kind: "search" | "explicit"; readonly filepath: string }
  | { readonly kind: "override" };

/**
 * The result of {@link loadConfigWithMeta}: the resolved config, where it was loaded from, and where its
 * glossary came from. `filepath` (when present) and a `glossary` file path are always absolute.
 */
export interface LoadedConfig {
  readonly config: VerbatraConfig;
  readonly source: ConfigSource;
  readonly glossary: GlossaryProvenance;
}

/**
 * Join a zod error's issues into one message. An unrecognized-key issue (most often a secret placed
 * in the config) gains a hint pointing to the environment.
 */
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

/**
 * Resolve a parsed config's `glossary` field (an inline record passes through; a file path is read and
 * validated) against `baseDir`, producing the final resolved {@link VerbatraConfig} and its provenance.
 */
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

/**
 * Load one explicit config file. The existsSync pre-check only buys the nicer not-found message; a
 * file that passes it but then fails to load (parse error, or vanishing between check and load) is
 * still caught and surfaced as `CONFIG_INVALID`, so no raw fs error escapes.
 */
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
    const detail = error instanceof Error ? error.message : String(error);
    throw new SdkError("CONFIG_INVALID", `Failed to load the verbatra configuration: ${detail}`);
  }

  const parsed = parseConfig(result?.config);
  const { config, glossary } = await finalizeConfig(parsed, dirname(resolved), fs);
  return { config, source: { kind: "explicit", filepath: resolved }, glossary };
}

/**
 * Load and validate the verbatra configuration, returning provenance alongside it: which source it was
 * loaded from ({@link ConfigSource}), and whether its glossary is absent, inline, or resolved from a
 * file ({@link GlossaryProvenance}). {@link loadConfig} is a thin wrapper that returns only the
 * `config` field; use this directly when the provenance is needed (for example, to display it or to
 * re-resolve a glossary file relative to the same base directory).
 *
 * @param options - Where/what to load: `cwd`, an in-memory `configOverride`, an explicit `configPath`,
 *   or a `fs` seam override.
 * @returns The resolved {@link VerbatraConfig}, its {@link ConfigSource}, and its {@link GlossaryProvenance}.
 * @throws {@link SdkError} `CONFIG_NOT_FOUND`: no config was found by search, or the explicit `configPath`
 *   does not exist.
 * @throws {@link SdkError} `CONFIG_INVALID`: a config was found but is unparseable or fails validation, or
 *   its glossary file path could not be read as a valid, UTF-8, flat string record (a raw error never
 *   escapes).
 */
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
    const detail = error instanceof Error ? error.message : String(error);
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

/**
 * Load and validate the verbatra configuration. Supports a code-defined
 * verbatra.config.ts and file-based configs (.verbatrarc.json/.yaml, package.json
 * property) through cosmiconfig + cosmiconfig-typescript-loader. Multiple sources ->
 * first-found-wins by cosmiconfig precedence. Any failure is a structured SdkError;
 * a raw zod error is never thrown upward and an unvalidated config never proceeds.
 *
 * Precedence: `configOverride` (validate in-memory) > `configPath` (load one explicit file) > search.
 *
 * A `glossary` given as a file path is read, parsed, and validated at load time (see
 * {@link loadConfigWithMeta} for its provenance); a relative path resolves against the loaded config
 * file's directory, or against `cwd` for a `configOverride`. Watch mode does not re-resolve a glossary
 * file on later edits; restart to pick up a change.
 *
 * @param options - Where/what to load: `cwd`, an in-memory `configOverride`, or an explicit `configPath`.
 * @returns The validated {@link VerbatraConfig}.
 * @throws {@link SdkError} `CONFIG_NOT_FOUND`: no config was found by search, or the explicit `configPath`
 *   does not exist.
 * @throws {@link SdkError} `CONFIG_INVALID`: a config was found but is unparseable or fails validation, or
 *   its glossary file path could not be resolved (a raw error never escapes).
 * @example
 * ```ts
 * import { loadConfig, translate } from "@verbatra/sdk";
 *
 * // Search upward from the cwd (verbatra.config.ts, .verbatrarc.json, or a package.json "verbatra" key):
 * const config = await loadConfig();
 * // Or load one explicit file (relative resolves against cwd; absolute as given):
 * // const config = await loadConfig({ configPath: "verbatra.config.ts" });
 *
 * const summary = await translate({ config });
 * ```
 */
export async function loadConfig(options: LoadConfigOptions = {}): Promise<VerbatraConfig> {
  const { config } = await loadConfigWithMeta(options);
  return config;
}
