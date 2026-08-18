import { extname, join } from "node:path";
import type { SupportedFormat } from "@verbatra/core";
import { type AdapterRegistry, createDefaultRegistry } from "@verbatra/format-adapters";
import { SdkError } from "../../errors.js";
import { defaultFs, type SdkFs } from "../../fs.js";
import type { ScaffoldableProviderId } from "../../scaffolding.js";
import { parseConfig } from "../parse-config.js";
import type { VerbatraConfigInput } from "../schema.js";
import { formatFromDependencyNames } from "./dependency-format.js";
import { type DetectionFs, type DirectoryScan, scanDirectory } from "./scan-directory.js";
import { buildDetectedProviderConfig, selectProviderFromEnv } from "./select-provider.js";

/**
 * The directories project detection looks in, in priority order. Every entry is a convention some
 * i18n ecosystem actually ships with, and nothing outside this list is scanned, so `node_modules`,
 * build output, and the rest of the tree are never walked.
 */
export const CANDIDATE_DIRECTORIES: readonly string[] = [
  "locales",
  "src/locales",
  "public/locales",
  "messages",
  "src/messages",
  "i18n",
  "src/i18n",
  "src/assets/i18n",
  "app/locales",
  "lang",
  "translations",
  "config/locales",
  "lib/l10n",
];

const PACKAGE_JSON_MAX_BYTES = 1024 * 1024;

/** What detection concluded about a project, reported so a run is never an unexplained black box. */
export interface ProjectDetection {
  /** The directory the locale files were found in, relative to the working directory. */
  readonly directory: string;
  /** The synthesized `files.pattern`. */
  readonly pattern: string;
  /** The format that was resolved, and how. */
  readonly format: SupportedFormat;
  /** The locale treated as the source. */
  readonly sourceLocale: string;
  /** Every other detected locale. */
  readonly targetLocales: readonly string[];
  /** The provider chosen from the environment. */
  readonly provider: ScaffoldableProviderId;
  /**
   * False when no provider API key was found and {@link ProjectDetection.provider} is a placeholder.
   * `check` and `diff` run regardless; a command that calls the provider must refuse.
   */
  readonly providerResolved: boolean;
  /** Providers whose keys were also set but lost to the fixed detection order. */
  readonly alsoAvailable: readonly ScaffoldableProviderId[];
}

/** A config detection synthesized, together with the reasoning behind it. */
export interface DetectedProject {
  /** The synthesized config, already validated against {@link verbatraConfigSchema}. */
  readonly config: VerbatraConfigInput;
  /** What detection concluded, for reporting to the user. */
  readonly detection: ProjectDetection;
}

/** Options for {@link detectProject}. */
export interface DetectProjectOptions {
  /** Directory to detect in. Defaults to the process working directory. */
  readonly cwd?: string;
  /** File-system port. Must implement `readDirectory`. Defaults to the real file system. */
  readonly fs?: SdkFs;
  /** Environment to read provider API keys from. Defaults to `process.env`. */
  readonly env?: NodeJS.ProcessEnv;
  /** Adapter registry used to resolve a format from a file extension. Defaults to the built-in one. */
  readonly adapterRegistry?: AdapterRegistry;
}

function requireDirectoryListing(fs: SdkFs): DetectionFs {
  const readDirectory = fs.readDirectory?.bind(fs);
  if (readDirectory === undefined) {
    throw new SdkError(
      "PROJECT_NOT_DETECTED",
      "Project detection needs to list directories, but the supplied file system does not implement readDirectory. Pass a config instead, or supply a file system that implements it.",
    );
  }
  return { readDirectory };
}

interface FoundLayout {
  readonly directory: string;
  readonly pattern: string;
  readonly locales: readonly string[];
}

function describePartial(directory: string, scan: DirectoryScan & { kind: "partial" }): never {
  throw new SdkError(
    "PROJECT_LAYOUT_UNSUPPORTED",
    `The locale files in ${directory} do not fit a single path pattern, so they cannot be detected automatically. verbatra maps one file per locale, and this directory needs ${scan.patterns.length}: ${scan.patterns.join(", ")}. Run "verbatra init" and set files.pattern to the one you want translated.`,
  );
}

function chooseLayout(found: readonly FoundLayout[]): FoundLayout {
  const [first, second] = found;
  if (first === undefined) {
    throw new SdkError(
      "PROJECT_NOT_DETECTED",
      `No verbatra configuration was found and no locale files could be detected. Looked in ${CANDIDATE_DIRECTORIES.join(", ")} for at least two files or directories named after locale codes. Run "verbatra init" to create a config, or check that you are in the right directory.`,
    );
  }
  if (second !== undefined) {
    throw new SdkError(
      "PROJECT_AMBIGUOUS",
      `Several directories look like locale directories: ${found.map((entry) => entry.directory).join(", ")}. Detection will not guess between them. Run "verbatra init" and set files.pattern to the one you want translated.`,
    );
  }
  return first;
}

async function findLayout(fs: DetectionFs, cwd: string): Promise<FoundLayout> {
  const found: FoundLayout[] = [];
  for (const directory of CANDIDATE_DIRECTORIES) {
    const scan = await scanDirectory(fs, cwd, directory);
    if (scan.kind === "partial") {
      describePartial(directory, scan);
    }
    if (scan.kind === "layout") {
      found.push({ directory, pattern: scan.pattern, locales: scan.locales });
    }
  }
  return chooseLayout(found);
}

async function readDependencyNames(fs: SdkFs, cwd: string): Promise<readonly string[]> {
  const read = await fs.readFileBounded(join(cwd, "package.json"), PACKAGE_JSON_MAX_BYTES);
  if (read.kind !== "ok") {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(read.content);
    const manifest = parsed as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return [
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.devDependencies ?? {}),
    ];
  } catch {
    return [];
  }
}

async function resolveFormat(
  registry: AdapterRegistry,
  fs: SdkFs,
  cwd: string,
  pattern: string,
): Promise<SupportedFormat> {
  const byExtension = registry.resolve(pattern);
  if (byExtension.status === "resolved") {
    return byExtension.adapter.format;
  }
  const byDependency = formatFromDependencyNames(await readDependencyNames(fs, cwd));
  if (byDependency !== undefined) {
    return byDependency;
  }
  throw new SdkError(
    "PROJECT_NOT_DETECTED",
    `The locale files matching ${pattern} are "${extname(pattern) || "extension-less"}" files, which several formats share, and package.json names no single i18n library to tell them apart. Run "verbatra init" and set the format explicitly.`,
  );
}

function chooseSourceLocale(locales: readonly string[]): string {
  const exact = locales.find((locale) => locale.toLowerCase() === "en");
  const regional = locales.find((locale) => locale.toLowerCase().startsWith("en-"));
  const source = exact ?? regional;
  if (source === undefined) {
    throw new SdkError(
      "PROJECT_NOT_DETECTED",
      `Locale files were detected (${locales.join(", ")}) but none of them is English, and detection uses English as the source locale. Run "verbatra init" and set sourceLocale explicitly.`,
    );
  }
  return source;
}

/**
 * Infers a whole verbatra configuration from a project's files and environment, for a project that
 * has no config file.
 *
 * Detection is deliberately conservative: it declines wherever it would otherwise have to guess,
 * because a `check` that silently reports on the wrong files is worse than one that asks for a
 * config. In particular it requires a single directory, a single path pattern covering every locale
 * file in it, an unambiguous format, and an English source locale.
 *
 * A provider is always named so the result satisfies the config schema, but
 * {@link ProjectDetection.providerResolved} is false when no API key backed it. Read-only commands
 * ignore that flag; anything that would call a provider must check it.
 *
 * @param options - Where to detect, and the file system, environment, and registry to use.
 * @returns The synthesized config and the reasoning behind it.
 *
 * @throws {@link SdkError} `PROJECT_NOT_DETECTED`: no candidate directory held a recognizable set of
 * locale files, the format could not be resolved, no detected locale is English, or the supplied
 * file system cannot list directories.
 * @throws {@link SdkError} `PROJECT_AMBIGUOUS`: more than one candidate directory holds a usable
 * locale layout.
 * @throws {@link SdkError} `PROJECT_LAYOUT_UNSUPPORTED`: a candidate directory needs more than one
 * path pattern, which verbatra cannot express because it maps one file per locale.
 * @throws {@link SdkError} `CONFIG_INVALID`: the synthesized config failed validation, which means
 * detection produced something the schema rejects.
 */
export async function detectProject(options: DetectProjectOptions = {}): Promise<DetectedProject> {
  const cwd = options.cwd ?? process.cwd();
  const fs = options.fs ?? defaultFs;
  const registry = options.adapterRegistry ?? createDefaultRegistry();

  const layout = await findLayout(requireDirectoryListing(fs), cwd);
  const format = await resolveFormat(registry, fs, cwd, layout.pattern);
  const sourceLocale = chooseSourceLocale(layout.locales);
  const targetLocales = layout.locales.filter((locale) => locale !== sourceLocale);
  const provider = selectProviderFromEnv(options.env ?? process.env);

  return {
    config: parseConfig({
      sourceLocale,
      targetLocales,
      format,
      files: { pattern: layout.pattern },
      provider: buildDetectedProviderConfig(provider.id),
    }),
    detection: {
      directory: layout.directory,
      pattern: layout.pattern,
      format,
      sourceLocale,
      targetLocales,
      provider: provider.id,
      providerResolved: provider.resolved,
      alsoAvailable: provider.alsoAvailable,
    },
  };
}
