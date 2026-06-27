import type {
  CheckInput,
  CheckSummary,
  ExportWorkbookInput,
  ExportWorkbookResult,
  ImportWorkbookInput,
  LoadConfigOptions,
  RunSummary,
  TranslateInput,
  VerbatraConfig,
  WatchController,
  WatchInput,
} from "@verbatra/sdk";

/** Output sink: the core writes through this, never to process.stdout/stderr directly. */
export interface Streams {
  /** Write to standard output (the run summary / JSON / NDJSON). */
  out(text: string): void;
  /** Write to standard error (the startup line, notices, and rendered errors). */
  err(text: string): void;
}

/**
 * The SDK entry points the CLI consumes, injected so tests pass stubs (no network, no files).
 * The real @verbatra/sdk functions satisfy these structurally; the bin shim wires them.
 */
export interface CliDeps {
  /** Load and validate the project config (the SDK's `loadConfig`). */
  loadConfig(options: LoadConfigOptions): Promise<VerbatraConfig>;
  /** Run the one-shot translation flow (the SDK's `translate`). */
  translate(input: TranslateInput): Promise<RunSummary>;
  /** Start watch mode (the SDK's `watch`). */
  watch(input: WatchInput): Promise<WatchController>;
  /** Export the translator workbook (the SDK's `exportWorkbook`). */
  exportWorkbook(input: ExportWorkbookInput): Promise<ExportWorkbookResult>;
  /** Import a filled workbook back into the locale files (the SDK's `importWorkbook`). */
  importWorkbook(input: ImportWorkbookInput): Promise<RunSummary>;
  /** Report missing and stale keys per locale without writing (the SDK's `check`). */
  check(input: CheckInput): Promise<CheckSummary>;
}

/** A long-running watch run. The bin shim wires SIGINT to requestStop; tests call it directly. */
export interface WatchSession {
  /** Resolves with the process exit code once watching has stopped. */
  readonly done: Promise<number>;
  /** First call stops gracefully (awaits the in-flight run) then exits 0; a second forces 130. */
  requestStop(): void;
}

/** Hooks the bin shim uses to attach real-world wiring; unused by tests that drive the session. */
export interface RunHooks {
  /** Called with the live watch session so the shim can wire SIGINT/SIGTERM to `requestStop`. */
  onWatchSession?(session: WatchSession): void;
}

/** Options for the `init` command (commander flags). */
export interface InitOpts {
  /** Directory to write the config and env files to; defaults to the process working directory. */
  readonly cwd?: string;
  /** Provider id to scaffold (anthropic, openai, gemini, or deepl). */
  readonly provider?: string;
  /** Source locale; defaults to "en". */
  readonly source?: string;
  /** Comma-separated target locales; defaults to "de". */
  readonly targets?: string;
  /** Locale file pattern containing the {locale} token; defaults to "locales/{locale}.json". */
  readonly path?: string;
  /** Accept defaults and run non-interactively. */
  readonly yes?: boolean;
  /** Overwrite an existing config or .env.example. */
  readonly force?: boolean;
}
