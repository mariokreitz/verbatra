/**
 * The verbatra SDK: the central orchestration API for automating i18n translation.
 *
 * Config: {@link defineConfig} types a `verbatra.config.ts` while you author it, {@link loadConfig}
 * finds and validates the project config, and {@link loadConfigWithMeta} adds config-source and
 * glossary provenance.
 *
 * Runs: {@link translate} performs the one-shot read, diff, translate, write flow over every target
 * locale, and {@link watch} re-runs it on each debounced source change.
 *
 * Paths: {@link createLocalePathResolver} turns the configured pattern, locales, and
 * {@link LocaleStyle} into the project's locale-to-path mapping, in both directions. Every flow
 * resolves paths through it, and a consumer that watches or reports on locale files should use it
 * rather than re-deriving the mapping.
 *
 * Read-only reporting: {@link check} and {@link diff} report pending work without writing;
 * {@link keyIntegrity} reports, per changed key, whether placeholders and ICU structure still match
 * the source; {@link lockState} reports the lock-file's existence, version, and per-locale drift;
 * {@link loadLockFile} reads the lock-file itself; {@link runStatus} reads the review-flag and
 * token-usage snapshot a prior run left behind; and {@link keyValue} reads one key's current source
 * and target text. {@link readLocaleFileSnapshot} and {@link diffLocaleSnapshots} reduce a locale
 * file to per-key hashes and compare two such snapshots, which is what a live-refresh watcher needs
 * to report what actually changed.
 *
 * Single-key writes: {@link editEntry} saves a manually corrected translation and
 * {@link retranslateEntry} re-runs the provider for one key. Both hold the same per-locale write
 * lock as a full run, and both hold their value to the same integrity gate.
 *
 * Translator handoff: {@link exportWorkbook} writes untranslated strings to an `.xlsx` workbook or
 * to one `.csv` or `.tsv` file per locale, and {@link importWorkbook} reads a filled handoff back
 * through the same diff, lock, and integrity checks.
 *
 * Errors: whole-run failures throw a structured, secret-free {@link SdkError}, while per-locale
 * failures, provider notices, and integrity findings are surfaced as data on the
 * {@link RunSummary}. Inspect {@link RunSummary.failed} rather than relying on a thrown error to
 * detect a bad locale.
 *
 * Security: API keys are read only from the environment, and only by the providers. The SDK never
 * reads or holds a key, and no config field carries one.
 *
 * @packageDocumentation
 */

export type { ReviewReasonCode } from "@verbatra/ai-providers";
export type { SupportedFormat } from "@verbatra/core";
export { CACHE_FILE_NAME } from "./cache/translation-memory.js";
export type { TranslationMemory } from "./cache/types.js";
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
export type { IntegrityGateReason } from "./flow/integrity-gate.js";
export {
  type KeyIntegrityDeps,
  type KeyIntegrityEntry,
  type KeyIntegrityInput,
  keyIntegrity,
  type LocaleKeyIntegrity,
} from "./flow/key-integrity.js";
export {
  type KeyValueDeps,
  type KeyValueInput,
  type KeyValueResult,
  keyValue,
} from "./flow/key-value.js";
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
  DuplicateKeyReport,
  LocaleNotice,
  LocaleSummary,
  MalformedRowReport,
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
export type { ExchangeFormat } from "./flow/workbook/exchange-format.js";
export {
  DEFAULT_DELIMITED_PATH,
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
  createLocalePathResolver,
  type LocalePathResolver,
  type LocalePathResolverConfig,
} from "./locale-path/resolver.js";
export type { LocaleStyle } from "./locale-path/style.js";
export {
  type LoadLockFileDeps,
  type LoadLockFileInput,
  loadLockFile,
} from "./lock/load-lock-file.js";
export type {
  LockHolder,
  LockWaitEvent,
  LockWaitListener,
} from "./lock/locale-write-lock.js";
export { LOCK_FILE_NAME } from "./lock/lock-file.js";
export type { LockFile } from "./lock/types.js";
export type {
  LocaleFinishedEvent,
  LocaleStartedEvent,
  ProgressEvent,
  ProgressListener,
  RunFinishedEvent,
  SubBatchProgressEvent,
} from "./progress/types.js";
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
