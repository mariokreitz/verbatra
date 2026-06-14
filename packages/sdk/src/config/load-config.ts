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
 * Load and validate the verbatra configuration. Supports a code-defined
 * verbatra.config.ts and file-based configs (.verbatrarc.json/.yaml, package.json
 * property) through cosmiconfig + cosmiconfig-typescript-loader. Multiple sources ->
 * first-found-wins by cosmiconfig precedence. Any failure is a structured SdkError;
 * a raw zod error is never thrown upward and an unvalidated config never proceeds.
 */
export async function loadConfig(options: LoadConfigOptions = {}): Promise<VerbatraConfig> {
  if (options.configOverride !== undefined) {
    return validate(options.configOverride);
  }

  const explorer = cosmiconfig(MODULE_NAME, {
    searchPlaces: SEARCH_PLACES,
    loaders: { ".ts": TypeScriptLoader() },
  });

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
