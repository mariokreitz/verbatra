import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { cosmiconfig } from "cosmiconfig";
import { TypeScriptLoader } from "cosmiconfig-typescript-loader";
import type { z } from "zod";
import { SdkError } from "../errors.js";
import { type VerbatraConfig, verbatraConfigSchema } from "./schema.js";

const MODULE_NAME = "verbatra";

/**
 * Search places in cosmiconfig precedence order. The first one found wins; multiple
 * present sources are not an ambiguity error. .ts is loaded via the TypeScript loader.
 */
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
   * An explicit config file to load instead of searching. A relative path resolves
   * against `cwd` (an absolute path is used as given), then cosmiconfig's load() parses
   * it with the same loaders search uses (.json/.yaml/.ts), and it is zod-validated at
   * the boundary exactly like a searched file. A missing file is CONFIG_NOT_FOUND; a
   * present-but-unparseable/invalid file is CONFIG_INVALID. Precedence: configOverride
   * wins over configPath, which wins over search.
   */
  readonly configPath?: string;
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      const base = path.length > 0 ? `${path}: ${issue.message}` : issue.message;
      // An unrecognized key (zod names the field, never its value) most often means a
      // secret was placed in config; teach that keys come from the environment instead.
      return issue.code === "unrecognized_keys"
        ? `${base} (API keys are read from the environment, not the config)`
        : base;
    })
    .join("; ");
}

function validate(input: unknown): VerbatraConfig {
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
 * Load and validate config from one explicit file via cosmiconfig's load(), which reuses the same
 * loaders search uses (.json/.yaml/.ts). A relative path resolves against cwd; an absolute path is
 * used as given. A genuinely missing file is CONFIG_NOT_FOUND. The existsSync pre-check only buys the
 * nicer not-found message and is not load-bearing: a file that passes the check but then fails to load
 * (a parse error, or the file vanishing between the check and the load) is caught here and surfaced as
 * CONFIG_INVALID — a raw fs/ENOENT error never escapes. Validation reuses the same zod boundary as the
 * search path, so a present-but-invalid (or empty) file is CONFIG_INVALID, identical in shape.
 */
async function loadExplicit(
  explorer: ReturnType<typeof cosmiconfig>,
  configPath: string,
  cwd: string | undefined,
): Promise<VerbatraConfig> {
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

  return validate(result?.config);
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
 * @param options - Where/what to load: `cwd`, an in-memory `configOverride`, or an explicit `configPath`.
 * @returns The validated {@link VerbatraConfig}.
 * @throws {@link SdkError} `CONFIG_NOT_FOUND` — no config was found by search, or the explicit `configPath`
 *   does not exist.
 * @throws {@link SdkError} `CONFIG_INVALID` — a config was found but is unparseable or fails validation
 *   (a raw zod error never escapes).
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
  if (options.configOverride !== undefined) {
    return validate(options.configOverride);
  }

  const explorer = cosmiconfig(MODULE_NAME, {
    searchPlaces: SEARCH_PLACES,
    loaders: { ".ts": TypeScriptLoader() },
  });

  if (options.configPath !== undefined) {
    return loadExplicit(explorer, options.configPath, options.cwd);
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

  return validate(result.config);
}
