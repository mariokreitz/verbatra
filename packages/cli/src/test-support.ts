import type {
  ExportWorkbookInput,
  ExportWorkbookResult,
  ImportWorkbookInput,
  LoadConfigOptions,
  LocaleSummary,
  RunSummary,
  TranslateInput,
  VerbatraConfig,
  WatchController,
  WatchInput,
} from "@verbatra/sdk";
import type { CliDeps, Streams } from "./types.js";

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
    invalidIcuSource: [],
    integrityMismatches: [],
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
}

/** Recording stub of the SDK deps. Override any of them to control behavior or throw. */
export function recordingDeps(impl: Partial<CliDeps> = {}): { deps: CliDeps; calls: DepCalls } {
  const calls: DepCalls = {
    loadConfig: [],
    translate: [],
    watch: [],
    exportWorkbook: [],
    importWorkbook: [],
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
  };
  return { deps, calls };
}

/** Flush pending microtasks so async actions settle without real timers. */
export async function flush(times = 8): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}
