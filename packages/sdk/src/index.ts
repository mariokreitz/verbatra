/**
 * The verbatra SDK: the central orchestration API for running translation. {@link loadConfig} loads and
 * validates the project config; {@link translate} runs the one-shot read, diff, translate, write flow
 * over all target locales; {@link watch} runs the same flow on each debounced source change;
 * {@link check} and {@link diff} report pending work without writing; {@link keyIntegrity} reports, per
 * changed key, whether its placeholders or ICU structure still match the source; {@link lockState}
 * reports the lock-file's existence, version, and per-locale drift, and {@link loadLockFile} reads the
 * lock-file itself. {@link runStatus} reads the persisted review-flag and token/usage snapshot a prior
 * non-dry-run {@link translate}/{@link watch} run left behind. {@link readLocaleFileSnapshot} and
 * {@link diffLocaleSnapshots} read one locale file as a
 * per-key content hash and compare two such snapshots, the building blocks a caller like Studio's
 * live-refresh watcher uses to report a locale file's own added, changed, and removed key counts
 * since its last observed state. For human-in-the-loop translation, {@link exportWorkbook} writes untranslated strings to an
 * `.xlsx` workbook and {@link importWorkbook} reads a filled workbook back through the same diff, lock,
 * and integrity checks. Whole-run failures
 * throw a structured, secret-free {@link SdkError}; per-locale failures, provider notices, and integrity
 * findings are surfaced as data on the {@link RunSummary} rather than thrown. API keys are read only from
 * the environment by the providers; the SDK never reads or holds a key, and the config carries none.
 *
 * @packageDocumentation
 */

export type { ReviewReasonCode } from "@verbatra/ai-providers";
export type { SupportedFormat } from "@verbatra/core";
export { defineConfig } from "./config/define-config.js";
export {
  type ConfigSource,
  type LoadConfigOptions,
  type LoadedConfig,
  loadConfig,
  loadConfigWithMeta,
} from "./config/load-config.js";
export type { ProviderConfig, ProviderId } from "./config/provider-config.js";
export type { GlossaryProvenance } from "./config/resolve-glossary.js";
export {
  type VerbatraConfig,
  type VerbatraConfigInput,
  verbatraConfigSchema,
} from "./config/schema.js";
export { SdkError, type SdkErrorCode } from "./errors.js";
export {
  type CheckDeps,
  type CheckInput,
  type CheckSummary,
  check,
  type LocaleCheckSummary,
} from "./flow/check.js";
export {
  type DiffDeps,
  type DiffInput,
  type DiffSummary,
  diff,
  type LocaleDiff,
} from "./flow/diff.js";
export {
  type EditEntryDeps,
  type EditEntryInput,
  type EditEntryResult,
  editEntry,
} from "./flow/edit-entry.js";
export {
  type KeyIntegrityDeps,
  type KeyIntegrityEntry,
  type KeyIntegrityInput,
  keyIntegrity,
  type LocaleKeyIntegrity,
} from "./flow/key-integrity.js";
export {
  diffLocaleSnapshots,
  type LocaleFileSnapshot,
  type LocaleSnapshotDelta,
  type ReadLocaleFileSnapshotDeps,
  type ReadLocaleFileSnapshotInput,
  readLocaleFileSnapshot,
} from "./flow/locale-snapshot.js";
export {
  type LockLocaleState,
  type LockStateDeps,
  type LockStateInput,
  type LockStateResult,
  lockState,
} from "./flow/lock-state.js";
export {
  type RetranslateEntryDeps,
  type RetranslateEntryInput,
  type RetranslateEntryResult,
  retranslateEntry,
} from "./flow/retranslate-entry.js";
export {
  type RunStatusDeps,
  type RunStatusInput,
  type RunStatusResult,
  runStatus,
} from "./flow/run-status.js";
export type {
  BudgetBehavior,
  LocaleNotice,
  LocaleSummary,
  NeedsReviewEntry,
  RunBudget,
  RunSummary,
  SdkNotice,
  SdkNoticeCode,
  UsageSummary,
} from "./flow/summary.js";
export {
  type TranslateDeps,
  type TranslateInput,
  translate,
} from "./flow/translate-project.js";
export {
  DEFAULT_WORKBOOK_PATH,
  type ExportWorkbookDeps,
  type ExportWorkbookInput,
  type ExportWorkbookResult,
  exportWorkbook,
} from "./flow/workbook/export-workbook.js";
export {
  type ImportWorkbookDeps,
  type ImportWorkbookInput,
  importWorkbook,
} from "./flow/workbook/import-workbook.js";
export type { SdkFs } from "./fs.js";
export {
  type LoadLockFileDeps,
  type LoadLockFileInput,
  loadLockFile,
} from "./lock/load-lock-file.js";
export { LOCK_FILE_NAME } from "./lock/lock-file.js";
export type { LockFile } from "./lock/types.js";
export type { RunStatusFile, RunStatusLocale } from "./run-status/types.js";
export { type ScaffoldableProviderId, scaffoldingMetadata } from "./scaffolding.js";
export type { CreateProvider } from "./selection/select-provider.js";
export {
  type CreateWatcher,
  type RunTranslate,
  type WatchController,
  type WatchDeps,
  type Watcher,
  type WatchInput,
  type WatchRunResult,
  watch,
} from "./watch/watch.js";
