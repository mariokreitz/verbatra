import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import {
  type ProviderId,
  type SupportedFormat,
  scaffoldingMetadata,
  verbatraConfigSchema,
} from "@verbatra/sdk";
import { askLine, stdinIsTty } from "./prompt.js";
import type { InitOpts, Streams } from "./types.js";

// Read provider, env-var, and model truth from the SDK scaffolding metadata rather than restating it.
const PROVIDER_IDS = Object.keys(scaffoldingMetadata.providerEnv) as ProviderId[];

// Maps a dependency id to the locale format it implies; typed against SupportedFormat so a renamed or
// removed core format id breaks this compile.
const FORMAT_BY_DEP: ReadonlyArray<readonly [string, SupportedFormat]> = [
  ["i18next", "i18next-json"],
  ["vue-i18n", "vue-i18n-json"],
  ["next-intl", "next-intl-json"],
  ["@ngx-translate/core", "ngx-translate-json"],
];
// The format comment lists the detectable JSON subset, not core's full source-format set.
const SUPPORTED_FORMATS = FORMAT_BY_DEP.map(([, format]) => format);
const DEFAULT_FORMAT: SupportedFormat = "i18next-json";
// An alias of the SDK's per-provider scaffold models, not a source of truth.
export const DEFAULT_MODEL = scaffoldingMetadata.scaffoldModels;
const TOKEN_LIMIT = 4096;

/** Prompting seams, injected so the decision logic is tested without a real TTY. */
export interface InitDeps {
  /** Reads one line for a prompt; defaults to the readline seam. Tests inject canned answers. */
  readonly ask?: (question: string) => Promise<string>;
  /** Reports whether stdin is a TTY; defaults to the real check. Tests force interactive or not. */
  readonly isTty?: () => boolean;
}

interface Inputs {
  readonly sourceLocale: string;
  readonly targetLocales: string[];
  readonly filesPattern: string;
  readonly provider: ProviderId;
}

function isProviderId(value: string): value is ProviderId {
  return (PROVIDER_IDS as string[]).includes(value);
}

/** Read the dependency + devDependency names from the project's package.json (empty if absent/invalid). */
function readDependencyNames(cwd: string): Set<string> {
  const pkgPath = resolve(cwd, "package.json");
  if (!existsSync(pkgPath)) {
    return new Set();
  }
  try {
    const parsed = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return new Set([
      ...Object.keys(parsed.dependencies ?? {}),
      ...Object.keys(parsed.devDependencies ?? {}),
    ]);
  } catch {
    return new Set();
  }
}

/** Pre-fill the format from a single matching dependency; otherwise fall back to the default. */
function detectFormat(cwd: string): { format: string; detected: boolean } {
  const deps = readDependencyNames(cwd);
  const matches = FORMAT_BY_DEP.filter(([dep]) => deps.has(dep)).map(([, format]) => format);
  // Only a single match is unambiguous; zero or several fall back to the default, marked undetected.
  const [first, second] = matches;
  if (first !== undefined && second === undefined) {
    return { format: first, detected: true };
  }
  return { format: DEFAULT_FORMAT, detected: false };
}

// Read this package's name at runtime so the scaffolded import stays correct if the package is renamed.
function readPackageName(): string {
  const manifestUrl = new URL("../package.json", import.meta.url);
  const { name } = JSON.parse(readFileSync(manifestUrl, "utf8")) as { name: string };
  return name;
}

// buildProviderConfig (the validated object) and renderProviderBlock (the emitted text) must stay in
// sync, since validation checks the object, not the text; the all-provider loadConfig round-trip guards
// against drift.
/** The provider block as a plain object, for validating the assembled config before writing. */
function buildProviderConfig(id: ProviderId): Record<string, unknown> {
  switch (id) {
    case "anthropic":
      return { id, options: { model: DEFAULT_MODEL.anthropic, maxTokens: TOKEN_LIMIT } };
    case "openai":
      return { id, options: { model: DEFAULT_MODEL.openai, maxOutputTokens: TOKEN_LIMIT } };
    case "gemini":
      return { id, options: { model: DEFAULT_MODEL.gemini, maxOutputTokens: TOKEN_LIMIT } };
    case "deepl":
      return { id, options: {} };
  }
}

/** The provider block rendered as commented TypeScript for the scaffolded config. */
function renderProviderBlock(id: ProviderId): string {
  if (id === "deepl") {
    return [
      "  provider: {",
      '    id: "deepl",',
      "    // DeepL needs no model; add an optional glossaryId here if you have one.",
      "    options: {},",
      "  },",
    ].join("\n");
  }
  const tokenKey = id === "anthropic" ? "maxTokens" : "maxOutputTokens";
  return [
    "  provider: {",
    `    id: ${JSON.stringify(id)},`,
    "    options: {",
    "      // A sensible default; change to any model this provider supports.",
    `      model: ${JSON.stringify(DEFAULT_MODEL[id])},`,
    `      ${tokenKey}: ${TOKEN_LIMIT},`,
    "    },",
    "  },",
  ].join("\n");
}

/** Render the scaffolded verbatra.config.ts; importName is the CLI's own package name. */
function renderConfig(
  inputs: Inputs,
  format: string,
  detected: boolean,
  importName: string,
): string {
  const formatComment = detected
    ? "  // Locale file format, detected from your dependencies."
    : `  // TODO: set your locale file format (one of: ${SUPPORTED_FORMATS.join(", ")}).`;
  return [
    `import { defineConfig } from ${JSON.stringify(importName)};`,
    "",
    "export default defineConfig({",
    "  // The locale your source strings are written in.",
    `  sourceLocale: ${JSON.stringify(inputs.sourceLocale)},`,
    "  // The locales to translate into (must not include the source locale).",
    `  targetLocales: ${JSON.stringify(inputs.targetLocales)},`,
    formatComment,
    `  format: ${JSON.stringify(format)},`,
    "  files: {",
    "    // Path to each locale file; must contain the {locale} token.",
    `    pattern: ${JSON.stringify(inputs.filesPattern)},`,
    "  },",
    renderProviderBlock(inputs.provider),
    "});",
    "",
  ].join("\n");
}

/** Render .env.example: the provider's key name only, never a literal value. */
function renderEnvExample(id: ProviderId): string {
  return [
    `# Copy this file to .env and set your ${id} API key. Do not commit your real key.`,
    `${scaffoldingMetadata.providerEnv[id]}=`,
    "",
  ].join("\n");
}

// Skip an existing file unless --force, so re-running init never clobbers a user's edits.
function writeFileIfAllowed(
  path: string,
  content: string,
  force: boolean,
  label: string,
  streams: Streams,
): void {
  const existed = existsSync(path);
  if (existed && !force) {
    streams.out(`skipped ${label} (exists; use --force to overwrite)\n`);
    return;
  }
  writeFileSync(path, content);
  streams.out(`${existed ? "overwrote" : "created"} ${label}\n`);
}

/** Ensure .env and .env.local are gitignored: create if absent, idempotently append otherwise. */
function ensureGitignore(cwd: string, streams: Streams): void {
  const gitignorePath = resolve(cwd, ".gitignore");
  const entries = [".env", ".env.local"];
  if (!existsSync(gitignorePath)) {
    writeFileSync(
      gitignorePath,
      `# Local environment files (never commit real keys)\n${entries.join("\n")}\n`,
    );
    streams.out("created .gitignore (.env, .env.local)\n");
    return;
  }
  const content = readFileSync(gitignorePath, "utf8");
  // Only append entries not already present, so re-running init never duplicates them.
  const present = new Set(content.split(/\r?\n/).map((line) => line.trim()));
  const missing = entries.filter((entry) => !present.has(entry));
  if (missing.length === 0) {
    streams.out(".gitignore already ignores .env and .env.local\n");
    return;
  }
  // Prepend a newline when the file is non-empty and lacks a trailing one so the entry starts on its own line.
  const prefix = content.length === 0 || content.endsWith("\n") ? "" : "\n";
  appendFileSync(gitignorePath, `${prefix}${missing.join("\n")}\n`);
  streams.out(`updated .gitignore (added ${missing.join(", ")})\n`);
}

/** Resolve the provider from the flag or an interactive prompt; report and return undefined on error. */
async function resolveProvider(
  opts: InitOpts,
  interactive: boolean,
  ask: (question: string) => Promise<string>,
  streams: Streams,
): Promise<ProviderId | undefined> {
  let value = opts.provider?.trim() ?? "";
  if (value === "" && interactive) {
    value = await ask(`Provider (${PROVIDER_IDS.join(", ")}): `);
  }
  if (value === "") {
    streams.err(`verbatra: --provider is required (one of ${PROVIDER_IDS.join(", ")})\n`);
    return undefined;
  }
  if (!isProviderId(value)) {
    streams.err(
      `verbatra: unknown provider "${value}" (expected one of ${PROVIDER_IDS.join(", ")})\n`,
    );
    return undefined;
  }
  return value;
}

/** A flag value, or an interactive prompt with a default, or the default when non-interactive. */
async function resolveValue(
  flag: string | undefined,
  interactive: boolean,
  ask: (question: string) => Promise<string>,
  label: string,
  fallback: string,
): Promise<string> {
  const flagValue = flag?.trim() ?? "";
  if (flagValue !== "") {
    return flagValue;
  }
  if (!interactive) {
    return fallback;
  }
  const answer = await ask(`${label} [${fallback}]: `);
  return answer === "" ? fallback : answer;
}

/**
 * Scaffold a verbatra config, a .env.example, and gitignore the real .env. Prompts only for
 * un-defaultable values when interactive; never writes a real key.
 *
 * @param opts - The parsed `init` flags.
 * @param streams - The output sink; init writes only human-readable status, never a key value.
 * @param deps - Injected prompting seams (ask, isTty); defaults to the real readline/TTY seam.
 * @returns 0 on success (including safe skips), 2 on a usage error (missing/unknown provider or an
 *   internally invalid scaffold).
 */
export async function runInit(
  opts: InitOpts,
  streams: Streams,
  deps: InitDeps = {},
): Promise<number> {
  const ask = deps.ask ?? askLine;
  const isTty = deps.isTty ?? stdinIsTty;
  const cwd = opts.cwd ?? process.cwd();
  // Prompt only with a real terminal and without --yes, so init runs unattended in CI.
  const interactive = opts.yes !== true && isTty();

  const provider = await resolveProvider(opts, interactive, ask, streams);
  if (provider === undefined) {
    return 2;
  }

  const sourceLocale = await resolveValue(opts.source, interactive, ask, "Source locale", "en");
  const targetsRaw = await resolveValue(
    opts.targets,
    interactive,
    ask,
    "Target locales (comma-separated)",
    "de",
  );
  const targetLocales = targetsRaw
    .split(",")
    .map((locale) => locale.trim())
    .filter((locale) => locale.length > 0);
  const filesPattern = await resolveValue(
    opts.path,
    interactive,
    ask,
    "Locale file pattern",
    "locales/{locale}.json",
  );

  const inputs: Inputs = { sourceLocale, targetLocales, filesPattern, provider };
  const { format, detected } = detectFormat(cwd);

  const candidate = {
    sourceLocale,
    targetLocales,
    format,
    files: { pattern: filesPattern },
    provider: buildProviderConfig(provider),
  };
  // Validate against the real schema before writing, so a scaffolding bug fails here with a clear message.
  const validated = verbatraConfigSchema.safeParse(candidate);
  if (!validated.success) {
    const detail = validated.error.issues.map((issue) => issue.message).join("; ");
    streams.err(`verbatra: could not scaffold a valid config: ${detail}\n`);
    return 2;
  }

  const importName = readPackageName();
  const force = opts.force === true;
  writeFileIfAllowed(
    resolve(cwd, "verbatra.config.ts"),
    renderConfig(inputs, format, detected, importName),
    force,
    "verbatra.config.ts",
    streams,
  );
  writeFileIfAllowed(
    resolve(cwd, ".env.example"),
    renderEnvExample(provider),
    force,
    ".env.example",
    streams,
  );
  ensureGitignore(cwd, streams);
  return 0;
}
