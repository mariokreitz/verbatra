/**
 * One structured progress notification emitted while a run advances through its locales and their
 * provider sub-batches. Emitted to a caller-supplied {@link ProgressListener}; the SDK itself writes
 * nothing to any stream, so a caller (the CLI) is free to render these to stderr and keep stdout a
 * clean summary or NDJSON stream. Discriminated on `type`, mirroring the lock-wait event contract.
 */
export type ProgressEvent =
  | LocaleStartedEvent
  | SubBatchProgressEvent
  | LocaleFinishedEvent
  | RunFinishedEvent;

/** A locale is about to be processed: its position in the run's target-locale order. */
export interface LocaleStartedEvent {
  readonly type: "locale-started";
  /** The target locale about to run. */
  readonly locale: string;
  /** Zero-based index of this locale in the run's target-locale order. */
  readonly localeIndex: number;
  /** Total number of target locales in this run. */
  readonly totalLocales: number;
}

/**
 * One sub-batch of a locale's main translation loop has been reached. Emitted once per loop
 * iteration, in order, so a caller can render a "batch N of M" line. Fired at the top of the
 * iteration regardless of whether the batch then makes a provider call: a budget-withheld batch
 * (the run's token budget already tripped) still emits this event, which keeps `batchIndex` 1-based
 * and contiguous against the total. A dry-run never reaches this loop and so never emits it.
 */
export interface SubBatchProgressEvent {
  readonly type: "sub-batch";
  /** The locale whose entries this sub-batch carries. */
  readonly locale: string;
  /** One-based index of this sub-batch within the locale. */
  readonly batchIndex: number;
  /** Total number of sub-batches this locale's main translation loop runs. */
  readonly totalBatches: number;
}

/** A locale finished processing: how many keys it accepted (translated). */
export interface LocaleFinishedEvent {
  readonly type: "locale-finished";
  /** The target locale that finished. */
  readonly locale: string;
  /** Number of keys accepted (translated) for this locale. In a dry-run, the keys that would be translated. */
  readonly translated: number;
  /**
   * Zero-based index of this locale in the run's target-locale order, carrying the same value as the
   * matching {@link LocaleStartedEvent}. This is a correlation key, so a consumer can pair a finish
   * with its start without matching on the locale name.
   *
   * It is deliberately NOT a progress counter. The worker pool claims indices up front, so this is a
   * claim ordinal rather than a completion ordinal: under concurrency the locales finish in a
   * different order, and rendering `localeIndex + 1` of `totalLocales` on a finish produces a
   * counter that jumps around and never reaches its own total in order. Do not reintroduce one.
   */
  readonly localeIndex: number;
  /** Total number of target locales in this run, mirroring {@link LocaleStartedEvent}. */
  readonly totalLocales: number;
}

/** The run reached the end of its locale loop: how many locales it processed. */
export interface RunFinishedEvent {
  readonly type: "run-finished";
  /**
   * Number of locales the run processed (including failed locales: a per-locale failure is isolated
   * as a summary rather than thrown, so it is still counted here).
   */
  readonly localesCompleted: number;
}

/**
 * Called with each {@link ProgressEvent} as a run advances; the SDK emits no output of its own. A
 * caller (the CLI) uses this to render progress, always to stderr, so stdout stays byte-identical to
 * a run with no listener attached.
 */
export type ProgressListener = (event: ProgressEvent) => void;
