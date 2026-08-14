import { OPENAI_COMPATIBLE_ENV_VAR, PROVIDER_ENV } from "@verbatra/ai-providers";
import type { AdapterRegistry } from "@verbatra/format-adapters";
import {
  type ConfigSource,
  type LoadConfigOptions,
  type LoadedConfig,
  loadConfigWithMeta,
} from "../config/load-config.js";
import {
  hasProviderFactory,
  PROVIDER_IDS,
  type ProviderConfig,
} from "../config/provider-config.js";
import type { VerbatraConfig } from "../config/schema.js";
import { errorMessage, SdkError } from "../errors.js";
import { defaultFs, type SdkFs } from "../fs.js";
import { createLocalePathResolver } from "../locale-path/resolver.js";
import { selectAdapter } from "../selection/select-adapter.js";

/**
 * Which project-setup question a {@link DoctorCheck} answers.
 *
 * - `config`: a config file was found and passes validation.
 * - `format-adapter`: the configured `format` resolves to a file adapter.
 * - `provider`: the configured `provider.id` resolves to a provider factory.
 * - `api-key`: the environment variable the configured provider reads its key from is set.
 * - `source-file`: the source locale file exists at its resolved path.
 */
export type DoctorCheckId = "config" | "format-adapter" | "provider" | "api-key" | "source-file";

/**
 * The verdict on one {@link DoctorCheck}. `skipped` is reported only for the checks that need a
 * loaded config when the `config` check itself failed, so a skipped check is never a problem of its
 * own.
 */
export type DoctorCheckStatus = "pass" | "fail" | "skipped";

/** One project-setup question and its verdict. */
export interface DoctorCheck {
  /** Which question this check answers. */
  readonly id: DoctorCheckId;
  /** A short human-readable name for the check, stable across runs. */
  readonly title: string;
  /** The verdict. Only `fail` makes {@link DoctorResult.ok} false. */
  readonly status: DoctorCheckStatus;
  /**
   * Why the check reached its verdict. On a failure this carries the underlying error message
   * verbatim, so a config validation problem reads exactly as {@link loadConfig} words it. It names
   * environment variables and paths, never an API key value.
   */
  readonly detail: string;
}

/** The result of {@link doctor}: every check that ran, and one project-wide verdict. */
export interface DoctorResult {
  /** True only when no check failed. This is the value a script should branch on. */
  readonly ok: boolean;
  /** Every check, always in the same order, one entry per {@link DoctorCheckId}. */
  readonly checks: readonly DoctorCheck[];
}

/** Input for {@link doctor}. */
export interface DoctorInput {
  /** Directory to search the config from, and the base for locale paths. Defaults to the process working directory. */
  readonly cwd?: string;
  /** An explicit config file to validate, bypassing the search. A missing file is an error rather than a failed check. */
  readonly configPath?: string;
}

/** Injectable dependencies for {@link doctor}. Every field has a working default. */
export interface DoctorDeps {
  /** Format-adapter registry to resolve the configured format against. Defaults to the built-in registry. */
  readonly adapterRegistry?: AdapterRegistry;
  /** File-system port used to probe the source locale file. Defaults to the real file system. */
  readonly fs?: SdkFs;
  /** Config loader. Defaults to {@link loadConfigWithMeta}. */
  readonly loadConfig?: (options: LoadConfigOptions) => Promise<LoadedConfig>;
}

const CHECK_TITLES: Record<DoctorCheckId, string> = {
  config: "Configuration",
  "format-adapter": "Format adapter",
  provider: "Provider",
  "api-key": "API key environment variable",
  "source-file": "Source locale file",
};

const CONFIG_DEPENDENT_IDS: readonly DoctorCheckId[] = [
  "format-adapter",
  "provider",
  "api-key",
  "source-file",
];

const SKIPPED_DETAIL = "Not checked: the configuration could not be loaded.";

function check(id: DoctorCheckId, status: DoctorCheckStatus, detail: string): DoctorCheck {
  return { id, title: CHECK_TITLES[id], status, detail };
}

function verdict(id: DoctorCheckId, passed: boolean, detail: string): DoctorCheck {
  return check(id, passed ? "pass" : "fail", detail);
}

function toResult(checks: readonly DoctorCheck[]): DoctorResult {
  return { ok: checks.every((entry) => entry.status !== "fail"), checks };
}

function loadOptionsFor(input: DoctorInput, deps: DoctorDeps): LoadConfigOptions {
  return {
    ...(input.cwd !== undefined ? { cwd: input.cwd } : {}),
    ...(input.configPath !== undefined ? { configPath: input.configPath } : {}),
    ...(deps.fs !== undefined ? { fs: deps.fs } : {}),
  };
}

type LoadOutcome =
  | { readonly kind: "loaded"; readonly loaded: LoadedConfig }
  | { readonly kind: "failed"; readonly detail: string };

function isMissingExplicitConfig(error: unknown, input: DoctorInput): boolean {
  return (
    input.configPath !== undefined && error instanceof SdkError && error.code === "CONFIG_NOT_FOUND"
  );
}

async function loadForDoctor(input: DoctorInput, deps: DoctorDeps): Promise<LoadOutcome> {
  const load = deps.loadConfig ?? loadConfigWithMeta;
  try {
    return { kind: "loaded", loaded: await load(loadOptionsFor(input, deps)) };
  } catch (error) {
    if (isMissingExplicitConfig(error, input)) {
      throw error;
    }
    return { kind: "failed", detail: errorMessage(error) };
  }
}

function configDetail(source: ConfigSource): string {
  return source.kind === "override"
    ? "Validated the config supplied in memory."
    : `Loaded ${source.filepath}.`;
}

function checkAdapter(config: VerbatraConfig, registry: AdapterRegistry | undefined): DoctorCheck {
  try {
    selectAdapter(config.format, registry);
    return verdict("format-adapter", true, `Format "${config.format}" resolves to an adapter.`);
  } catch (error) {
    return verdict("format-adapter", false, errorMessage(error));
  }
}

function checkProvider(provider: ProviderConfig): DoctorCheck {
  return hasProviderFactory(provider.id)
    ? verdict("provider", true, `Provider "${provider.id}" resolves to a factory.`)
    : verdict(
        "provider",
        false,
        `No factory is registered for provider "${provider.id}". Supported providers: ${PROVIDER_IDS.join(", ")}.`,
      );
}

function isEnvVarSet(name: string): boolean {
  const value = process.env[name];
  return value !== undefined && value.length > 0;
}

function envVarVerdict(name: string): DoctorCheck {
  return isEnvVarSet(name)
    ? verdict("api-key", true, `${name} is set.`)
    : verdict("api-key", false, `The ${name} environment variable is not set.`);
}

function checkOpenAiCompatibleKey(apiKeyEnvVar: string | undefined): DoctorCheck {
  if (apiKeyEnvVar === undefined) {
    return verdict(
      "api-key",
      true,
      `The openai-compatible provider needs no API key. Set ${OPENAI_COMPATIBLE_ENV_VAR} only if your server requires one, or name your own variable with provider.options.apiKeyEnvVar.`,
    );
  }
  return envVarVerdict(apiKeyEnvVar);
}

function checkApiKey(provider: ProviderConfig): DoctorCheck {
  return provider.id === "openai-compatible"
    ? checkOpenAiCompatibleKey(provider.options.apiKeyEnvVar)
    : envVarVerdict(PROVIDER_ENV[provider.id]);
}

async function checkSourceFile(
  config: VerbatraConfig,
  cwd: string,
  fs: SdkFs,
): Promise<DoctorCheck> {
  let sourcePath: string;
  try {
    sourcePath = createLocalePathResolver(cwd, config).pathFor(config.sourceLocale);
  } catch (error) {
    return verdict("source-file", false, errorMessage(error));
  }
  return (await fs.fileExists(sourcePath))
    ? verdict("source-file", true, `Found ${sourcePath}.`)
    : verdict("source-file", false, `The source locale file was not found at ${sourcePath}.`);
}

/**
 * Validates a project's setup and spends nothing: no provider is constructed, no network request is
 * made, and no file is written. Run it before {@link translate} on a fresh project, or when a run
 * failed and you want the whole list of problems rather than the first one.
 *
 * Five checks run: the config loads and validates, the configured format resolves to an adapter,
 * the configured provider ID resolves to a factory, the environment variable that provider reads
 * its API key from is set, and the source locale file exists. Every check runs even when an earlier
 * one failed, so one call reports every independent problem. The API key is checked by variable
 * name only: its value is never read, never returned, and never validated against a provider.
 *
 * The `openai-compatible` provider is the one exception on the key check. It falls back to a
 * placeholder key, so a missing variable passes unless the config names its own variable through
 * `provider.options.apiKeyEnvVar`, which then has to be set.
 *
 * A missing target locale file is not a problem and is not checked: {@link translate} creates it.
 * A missing source locale file is, because every other entry point fails on it.
 *
 * When the config cannot be loaded the four config-dependent checks report `skipped` rather than a
 * verdict they could not reach, and {@link DoctorResult.ok} is false because the config check
 * itself failed.
 *
 * @param input - The working directory and an optional explicit config path.
 * @param deps - Optional adapter registry, file-system, and config-loader overrides.
 * @returns Every check with its verdict, and the project-wide `ok` verdict.
 *
 * @throws {@link SdkError} `CONFIG_NOT_FOUND`: an explicit `configPath` was given and no file
 * exists there. A config that is merely absent from the search is a failed check instead.
 *
 * @example
 * ```ts
 * import { doctor } from "@verbatra/sdk";
 *
 * const report = await doctor();
 * for (const check of report.checks) {
 *   console.log(`${check.status}: ${check.title} - ${check.detail}`);
 * }
 * process.exitCode = report.ok ? 0 : 1;
 * ```
 */
export async function doctor(
  input: DoctorInput = {},
  deps: DoctorDeps = {},
): Promise<DoctorResult> {
  const outcome = await loadForDoctor(input, deps);
  if (outcome.kind === "failed") {
    return toResult([
      verdict("config", false, outcome.detail),
      ...CONFIG_DEPENDENT_IDS.map((id) => check(id, "skipped", SKIPPED_DETAIL)),
    ]);
  }
  const { config, source } = outcome.loaded;
  return toResult([
    verdict("config", true, configDetail(source)),
    checkAdapter(config, deps.adapterRegistry),
    checkProvider(config.provider),
    checkApiKey(config.provider),
    await checkSourceFile(config, input.cwd ?? process.cwd(), deps.fs ?? defaultFs),
  ]);
}
