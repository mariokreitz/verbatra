/**
 * The verbatra SDK: the central orchestration API a consumer calls to run translation. {@link loadConfig}
 * loads and validates the project config; {@link translate} runs the one-shot read -> diff -> translate ->
 * write flow over all target locales, composing the audited format adapters and providers; {@link watch}
 * runs the same flow on each debounced source change. For human-in-the-loop translation,
 * {@link exportWorkbook} writes the untranslated strings to an `.xlsx` workbook and {@link importWorkbook}
 * reads a filled workbook back through the same diff/lock/integrity checks. Whole-run failures throw a
 * structured, secret-free {@link SdkError}; per-locale failures, provider notices, and integrity findings
 * are surfaced as data on the {@link RunSummary} rather than thrown. API keys are read only from the
 * environment by the providers; the SDK never reads or holds a key, and the config carries none.
 *
 * @packageDocumentation
 */

// Config
export { defineConfig } from "./config/define-config.js";
export { type LoadConfigOptions, loadConfig } from "./config/load-config.js";
export type { ProviderConfig, ProviderId } from "./config/provider-config.js";
export { type VerbatraConfig, verbatraConfigSchema } from "./config/schema.js";
// Errors
export { SdkError, type SdkErrorCode } from "./errors.js";
export type { LocaleSummary, RunSummary } from "./flow/summary.js";
// Orchestration entry point
export {
  type TranslateDeps,
  type TranslateInput,
  translate,
} from "./flow/translate-project.js";
// Manual-translation workbook export/import
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
// File-system seam
export type { SdkFs } from "./fs.js";
// Provider construction seam
export type { CreateProvider } from "./selection/select-provider.js";
// Watch mode (slice 2)
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
