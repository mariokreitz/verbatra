import type {
  CheckInput,
  CheckSummary,
  ConfigSource,
  DiffInput,
  DiffSummary,
  ExportWorkbookInput,
  ExportWorkbookResult,
  ImportWorkbookInput,
  LoadConfigOptions,
  LoadedConfig,
  LocaleSummary,
  RunSummary,
  TranslateInput,
  VerbatraConfig,
  WatchController,
  WatchInput,
} from "@verbatra/sdk";
import { DEFAULT_STUDIO_PORT } from "@verbatra/studio";
import type { CliDeps, Streams, StudioModule } from "./types.js";

/** A minimal valid config with an anthropic provider; override any field. */
export function makeConfig(overrides: Partial<VerbatraConfig> = {}): VerbatraConfig {
  return {
    sourceLocale: "en",
    targetLocales: ["de"],
    format: "i18next-json",
    files: { pattern: "locales/{locale}.json" },
    provider: { id: "anthropic", options: { model: "test-model", maxTokens: 256 } },
    ...overrides,
  };
}

/** A succeeded locale summary with all key lists empty; override any field. */
export function makeLocale(overrides: Partial<LocaleSummary> = {}): LocaleSummary {
  return {
    locale: "de",
    status: "succeeded",
    translated: [],
    unchanged: [],
    orphaned: [],
    pruned: [],
    invalidIcuSource: [],
    integrityMismatches: [],
    providerFailures: [],
    budgetWithheld: [],
    generated: [],
    notices: [],
    needsReview: [],
    unfilled: [],
    malformedRows: [],
    duplicateKeys: [],
    ...overrides,
  };
}

/** An empty non-dry-run summary; override any field. */
export function makeSummary(overrides: Partial<RunSummary> = {}): RunSummary {
  return { dryRun: false, locales: [], succeeded: [], partial: [], failed: [], ...overrides };
}

/** An export result with a fixed workbook path and no locales; override any field. */
export function makeExportResult(
  overrides: Partial<ExportWorkbookResult> = {},
): ExportWorkbookResult {
  return { path: "/proj/verbatra-translations.xlsx", locales: [], ...overrides };
}

/** An in-sync check summary with no locales; override any field. */
export function makeCheckSummary(overrides: Partial<CheckSummary> = {}): CheckSummary {
  return { inSync: true, locales: [], ...overrides };
}

/** A diff summary with nothing pending and no locales; override any field. */
export function makeDiffSummary(overrides: Partial<DiffSummary> = {}): DiffSummary {
  return { hasPendingChanges: false, locales: [], ...overrides };
}

/** A loaded config with search provenance and no glossary; override any field. */
export function makeLoadedConfig(overrides: Partial<LoadedConfig> = {}): LoadedConfig {
  return {
    config: makeConfig(),
    source: { kind: "search", filepath: "/proj/verbatra.config.ts" } satisfies ConfigSource,
    glossary: { source: "none" },
    ...overrides,
  };
}

/**
 * Fake `@verbatra/studio` module: a `startStudioServer` returning a fake server whose `close` never
 * throws. Uses the real `DEFAULT_STUDIO_PORT` value; that value import is safe only because this
 * file is test-only and never bundled by tsup, so it is not part of the CLI's dynamic-import
 * contract for `@verbatra/studio`.
 */
export function makeStudioModule(overrides: Partial<StudioModule> = {}): StudioModule {
  return {
    startStudioServer: async (options) => ({
      url: `http://127.0.0.1:${options.port ?? DEFAULT_STUDIO_PORT}/`,
      port: options.port ?? DEFAULT_STUDIO_PORT,
      close: async () => {},
    }),
    ...overrides,
  };
}

/** An accumulating stream sink that captures everything written to out and err. */
export function captureStreams(): { streams: Streams; out: () => string; err: () => string } {
  let outBuf = "";
  let errBuf = "";
  return {
    streams: {
      out: (text) => {
        outBuf += text;
      },
      err: (text) => {
        errBuf += text;
      },
    },
    out: () => outBuf,
    err: () => errBuf,
  };
}

/** The recorded inputs of every `recordingDeps` call, one array per SDK entry point. */
export interface DepCalls {
  loadConfig: LoadConfigOptions[];
  translate: TranslateInput[];
  watch: WatchInput[];
  exportWorkbook: ExportWorkbookInput[];
  importWorkbook: ImportWorkbookInput[];
  check: CheckInput[];
  diff: DiffInput[];
  loadConfigWithMeta: LoadConfigOptions[];
  importStudio: undefined[];
}

/** A recording stub of the SDK deps. Override any of them to control behavior or throw. */
export function recordingDeps(impl: Partial<CliDeps> = {}): { deps: CliDeps; calls: DepCalls } {
  const calls: DepCalls = {
    loadConfig: [],
    translate: [],
    watch: [],
    exportWorkbook: [],
    importWorkbook: [],
    check: [],
    diff: [],
    loadConfigWithMeta: [],
    importStudio: [],
  };
  const deps: CliDeps = {
    loadConfig: async (options) => {
      calls.loadConfig.push(options);
      return impl.loadConfig ? impl.loadConfig(options) : makeConfig();
    },
    translate: async (input) => {
      calls.translate.push(input);
      return impl.translate ? impl.translate(input) : makeSummary();
    },
    watch: async (input) => {
      calls.watch.push(input);
      return impl.watch ? impl.watch(input) : ({ stop: async () => {} } satisfies WatchController);
    },
    exportWorkbook: async (input) => {
      calls.exportWorkbook.push(input);
      return impl.exportWorkbook ? impl.exportWorkbook(input) : makeExportResult();
    },
    importWorkbook: async (input) => {
      calls.importWorkbook.push(input);
      return impl.importWorkbook ? impl.importWorkbook(input) : makeSummary();
    },
    check: async (input) => {
      calls.check.push(input);
      return impl.check ? impl.check(input) : makeCheckSummary();
    },
    diff: async (input) => {
      calls.diff.push(input);
      return impl.diff ? impl.diff(input) : makeDiffSummary();
    },
    loadConfigWithMeta: async (options) => {
      calls.loadConfigWithMeta.push(options);
      return impl.loadConfigWithMeta ? impl.loadConfigWithMeta(options) : makeLoadedConfig();
    },
    importStudio: async () => {
      calls.importStudio.push(undefined);
      return impl.importStudio ? impl.importStudio() : makeStudioModule();
    },
  };
  return { deps, calls };
}

/** Flushes pending microtasks so async actions settle without real timers. */
export async function flush(times = 8): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}
