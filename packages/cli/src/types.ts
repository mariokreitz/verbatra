import type {
  LoadConfigOptions,
  RunSummary,
  TranslateInput,
  VerbatraConfig,
  WatchController,
  WatchInput,
} from "@verbatra/sdk";

/** Output sink: the core writes through this, never to process.stdout/stderr directly. */
export interface Streams {
  out(text: string): void;
  err(text: string): void;
}

/**
 * The SDK entry points the CLI consumes, injected so tests pass stubs (no network, no files).
 * The real @verbatra/sdk functions satisfy these structurally; the bin shim wires them.
 */
export interface CliDeps {
  loadConfig(options: LoadConfigOptions): Promise<VerbatraConfig>;
  translate(input: TranslateInput): Promise<RunSummary>;
  watch(input: WatchInput): Promise<WatchController>;
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
  onWatchSession?(session: WatchSession): void;
}
