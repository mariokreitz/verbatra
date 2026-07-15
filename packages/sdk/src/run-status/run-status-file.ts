import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import type { LocaleSummary, RunSummary } from "../flow/summary.js";
import type { SdkFs } from "../fs.js";
import type { RunStatusFile, RunStatusLocale } from "./types.js";

/** The gitignored local-state directory, scaffolded by `verbatra init` into a project's `.gitignore`. */
export const RUN_STATUS_DIR_NAME = ".verbatra-local";
const RUN_STATUS_FILE_NAME = "run-status.json";

const CURRENT_VERSION = 1;

/** Size cap for the read: this file is best-effort, gitignored, and never expected to grow unbounded. */
const MAX_RUN_STATUS_FILE_BYTES = 16 * 1024 * 1024;

const reviewReasonCodeSchema = z.enum([
  "LENGTH_RATIO_OUTLIER",
  "EQUALS_SOURCE",
  "GLOSSARY_TERM_MISSED",
  "INTEGRITY_REORDERED",
  "PROVIDER_DEGRADED",
]);

const needsReviewEntrySchema = z.object({
  key: z.string(),
  reasons: z.array(reviewReasonCodeSchema),
});

const usageSummarySchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
});

const runBudgetSchema = z.object({
  maxTokens: z.number().int().nonnegative(),
  behavior: z.enum(["warn", "stop"]),
  supported: z.boolean(),
  tokensUsed: z.number().int().nonnegative(),
  exceeded: z.boolean(),
});

const runStatusLocaleSchema = z.object({
  locale: z.string(),
  status: z.enum(["succeeded", "failed"]),
  needsReview: z.array(needsReviewEntrySchema),
  usage: usageSummarySchema.optional(),
});

const runStatusFileSchema = z.object({
  version: z.number().int().positive(),
  generatedAt: z.string(),
  usage: usageSummarySchema.optional(),
  budget: runBudgetSchema.optional(),
  locales: z.array(runStatusLocaleSchema),
});

export function runStatusFilePath(cwd: string): string {
  return resolve(cwd, RUN_STATUS_DIR_NAME, RUN_STATUS_FILE_NAME);
}

function toRunStatusLocale(locale: LocaleSummary): RunStatusLocale {
  return {
    locale: locale.locale,
    status: locale.status,
    needsReview: locale.needsReview,
    ...(locale.usage !== undefined ? { usage: locale.usage } : {}),
  };
}

/**
 * Project an already-assembled `RunSummary` onto the persisted shape: no new aggregation, every field
 * taken directly from the summary. `generatedAt` defaults to now; overridable so callers can pass a
 * fixed value in tests.
 */
export function buildRunStatusFile(
  summary: RunSummary,
  generatedAt: string = new Date().toISOString(),
): RunStatusFile {
  return {
    version: CURRENT_VERSION,
    generatedAt,
    ...(summary.usage !== undefined ? { usage: summary.usage } : {}),
    ...(summary.budget !== undefined ? { budget: summary.budget } : {}),
    locales: summary.locales.map(toRunStatusLocale),
  };
}

function fromParsed(data: z.infer<typeof runStatusFileSchema>): RunStatusFile {
  return {
    version: data.version,
    generatedAt: data.generatedAt,
    ...(data.usage !== undefined ? { usage: data.usage } : {}),
    ...(data.budget !== undefined ? { budget: data.budget } : {}),
    locales: data.locales.map((locale) => ({
      locale: locale.locale,
      status: locale.status,
      needsReview: locale.needsReview,
      ...(locale.usage !== undefined ? { usage: locale.usage } : {}),
    })),
  };
}

/**
 * Read the run-status file. Unlike `readLockFile`, this never throws: a missing file, invalid JSON, a
 * schema mismatch, or an unrecognized `version` all degrade to `undefined`, since this file is
 * best-effort telemetry, not a correctness baseline.
 */
export async function readRunStatusFile(
  path: string,
  fs: SdkFs,
): Promise<RunStatusFile | undefined> {
  const read = await fs.readFileBounded(path, MAX_RUN_STATUS_FILE_BYTES);
  if (read.kind !== "ok") {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(read.content);
  } catch {
    return undefined;
  }
  const result = runStatusFileSchema.safeParse(parsed);
  if (!result.success || result.data.version !== CURRENT_VERSION) {
    return undefined;
  }
  return fromParsed(result.data);
}

/**
 * Write the run-status file, creating `.verbatra-local/` first if it does not already exist. The
 * directory is created directly through node's fs, not through `SdkFs`: creating a directory is not a
 * file operation the seam models, and the atomic file write below (temp file, then rename) requires
 * the containing directory to already exist. Throws on failure; the caller in `translate()` is
 * responsible for catching and swallowing it, since this write is best-effort by design.
 */
export async function writeRunStatusFile(
  path: string,
  data: RunStatusFile,
  fs: SdkFs,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, `${JSON.stringify(data, null, 2)}\n`);
}
