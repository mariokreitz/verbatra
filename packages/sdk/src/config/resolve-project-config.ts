import { PROVIDER_ENV } from "@verbatra/ai-providers";
import { SdkError } from "../errors.js";
import {
  type DetectProjectOptions,
  detectProject,
  type ProjectDetection,
} from "./detect/detect-project.js";
import { PROVIDER_DETECTION_ORDER } from "./detect/select-provider.js";
import { type LoadConfigOptions, type LoadedConfig, loadConfigWithMeta } from "./load-config.js";
import type { VerbatraConfig } from "./schema.js";

/** Options for {@link resolveProjectConfig}: everything {@link loadConfig} takes, plus detection inputs. */
export interface ResolveProjectConfigOptions extends LoadConfigOptions {
  /** Environment to read provider API keys from during detection. Defaults to `process.env`. */
  readonly env?: NodeJS.ProcessEnv;
  /** Set false to keep the plain `CONFIG_NOT_FOUND` failure instead of detecting. Defaults to true. */
  readonly detect?: boolean;
}

/**
 * A project configuration, whether it was written by the user or inferred from the project.
 *
 * The two cases are told apart by {@link ResolvedProjectConfig.detection}: it is `undefined` for a
 * config that came from a file or an override, and present when nothing was found on disk and the
 * config was synthesized.
 */
export interface ResolvedProjectConfig {
  /** The validated, fully resolved config. */
  readonly config: VerbatraConfig;
  /** The provenance of a loaded config, or `undefined` when the config was detected. */
  readonly loaded: LoadedConfig | undefined;
  /** What detection concluded, or `undefined` when a real config was loaded. */
  readonly detection: ProjectDetection | undefined;
}

function isSearchMiss(error: unknown, configPath: string | undefined): boolean {
  return configPath === undefined && error instanceof SdkError && error.code === "CONFIG_NOT_FOUND";
}

function loadConfigOptions(options: ResolveProjectConfigOptions): LoadConfigOptions {
  return {
    ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
    ...(options.configOverride !== undefined ? { configOverride: options.configOverride } : {}),
    ...(options.configPath !== undefined ? { configPath: options.configPath } : {}),
    ...(options.fs !== undefined ? { fs: options.fs } : {}),
  };
}

function detectOptions(options: ResolveProjectConfigOptions): DetectProjectOptions {
  return {
    ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
    ...(options.fs !== undefined ? { fs: options.fs } : {}),
    ...(options.env !== undefined ? { env: options.env } : {}),
  };
}

/**
 * Resolves the configuration for a project, falling back to detection when no config file exists.
 *
 * This is the entry point a command-line tool or CI job should call. It behaves exactly like
 * {@link loadConfigWithMeta} whenever a config is present, so an authored config always wins and
 * nothing about the existing path changes. Only when the search finds nothing does it infer a
 * configuration from the project's locale files and the provider API keys in the environment, which
 * is what lets `check` and `diff` run against a project that has never been configured.
 *
 * An explicit `configPath` is never detected around: a path that does not exist stays an error, so a
 * typo cannot silently fall through to a guess at a different project.
 *
 * Detection never calls a provider and never writes anything. When it names a provider that no API
 * key backs, {@link ProjectDetection.providerResolved} is false, and a caller that is about to spend
 * money must pass the result through {@link requireDetectedProvider} first.
 *
 * @param options - Where and how to look, plus the environment detection reads keys from.
 * @returns The resolved config, with either its load provenance or its detection reasoning.
 *
 * @throws {@link SdkError} `CONFIG_NOT_FOUND`: an explicit `configPath` does not exist, or `detect`
 * was set false and the search found nothing.
 * @throws {@link SdkError} `CONFIG_INVALID`: a config was found but is unparseable or fails
 * validation, or its glossary file could not be resolved.
 * @throws {@link SdkError} `PROJECT_NOT_DETECTED`: no config exists and no locale layout could be
 * inferred.
 * @throws {@link SdkError} `PROJECT_AMBIGUOUS`: no config exists and several directories look like
 * locale directories.
 * @throws {@link SdkError} `PROJECT_LAYOUT_UNSUPPORTED`: no config exists and the detected layout
 * needs more than one path pattern.
 *
 * @example
 * ```ts
 * import { check, resolveProjectConfig } from "@verbatra/sdk";
 *
 * const { config, detection } = await resolveProjectConfig();
 * if (detection !== undefined) {
 *   console.log(`detected ${detection.format} in ${detection.directory}`);
 * }
 * const summary = await check({ config });
 * ```
 */
export async function resolveProjectConfig(
  options: ResolveProjectConfigOptions = {},
): Promise<ResolvedProjectConfig> {
  try {
    const loaded = await loadConfigWithMeta(loadConfigOptions(options));
    return { config: loaded.config, loaded, detection: undefined };
  } catch (error) {
    if (options.detect === false || !isSearchMiss(error, options.configPath)) {
      throw error;
    }
  }

  const detected = await detectProject(detectOptions(options));
  const { glossary, ...config } = detected.config;
  void glossary;
  return { config, loaded: undefined, detection: detected.detection };
}

/**
 * Asserts that a resolved config can actually reach a translation provider, and reports the exact
 * remedy when it cannot.
 *
 * A configuration written by hand always names a provider deliberately, so this is a no-op for it.
 * A detected configuration names one only if an API key was found in the environment, and this is
 * the single point where zero-config operation genuinely cannot continue: `check` and `diff` need no
 * key, but `translate` and `watch` do.
 *
 * @param resolved - The result of {@link resolveProjectConfig}.
 *
 * @throws {@link SdkError} `PROVIDER_KEY_MISSING`: the config was detected rather than authored and
 * no supported provider API key is set in the environment.
 */
export function requireDetectedProvider(resolved: ResolvedProjectConfig): void {
  if (resolved.detection === undefined || resolved.detection.providerResolved) {
    return;
  }
  const variables = PROVIDER_DETECTION_ORDER.map((id) => PROVIDER_ENV[id]).join(", ");
  throw new SdkError(
    "PROVIDER_KEY_MISSING",
    `No verbatra configuration was found and no provider API key is set, so there is nothing to translate with. Set one of ${variables}, or run "verbatra init" to create a config.`,
  );
}
