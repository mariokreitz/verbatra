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
// A real value import, not a runtime concern here: this file is test-only, never bundled by tsup,
// so it is not part of the CLI's dynamic-import contract for @verbatra/studio.
import { DEFAULT_STUDIO_PORT } from "@verbatra/studio";
import type { CliDeps, Streams, StudioModule } from "./types.js";

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
    ...overrides,
  };
}

export function makeSummary(overrides: Partial<RunSummary> = {}): RunSummary {
  return { dryRun: false, locales: [], succeeded: [], failed: [], ...overrides };
}

export function makeExportResult(
  overrides: Partial<ExportWorkbookResult> = {},
): ExportWorkbookResult {
  return { path: "/proj/verbatra-translations.xlsx", locales: [], ...overrides };
}

export function makeCheckSummary(overrides: Partial<CheckSummary> = {}): CheckSummary {
  return { inSync: true, locales: [], ...overrides };
}

export function makeDiffSummary(overrides: Partial<DiffSummary> = {}): DiffSummary {
  return { hasPendingChanges: false, locales: [], ...overrides };
}

export function makeLoadedConfig(overrides: Partial<LoadedConfig> = {}): LoadedConfig {
  return {
    config: makeConfig(),
    source: { kind: "search", filepath: "/proj/verbatra.config.ts" } satisfies ConfigSource,
    glossary: { source: "none" },
    ...overrides,
  };
}

/** Fake `@verbatra/studio` module: a `startStudioServer` returning a fake server whose `close` never throws. */
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

/** Accumulating stream sink: captures everything written to out and err. */
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

/** Recording stub of the SDK deps. Override any of them to control behavior or throw. */
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

/** Flush pending microtasks so async actions settle without real timers. */
export async function flush(times = 8): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}
