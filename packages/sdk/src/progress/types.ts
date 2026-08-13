export type ProgressEvent =
  | LocaleStartedEvent
  | SubBatchProgressEvent
  | LocaleFinishedEvent
  | RunFinishedEvent;

export interface LocaleStartedEvent {
  readonly type: "locale-started";
  readonly locale: string;
  readonly localeIndex: number;
  readonly totalLocales: number;
}

export interface SubBatchProgressEvent {
  readonly type: "sub-batch";
  readonly locale: string;
  readonly batchIndex: number;
  readonly totalBatches: number;
}

export interface LocaleFinishedEvent {
  readonly type: "locale-finished";
  readonly locale: string;
  readonly translated: number;
  readonly localeIndex: number;
  readonly totalLocales: number;
}

export interface RunFinishedEvent {
  readonly type: "run-finished";
  readonly localesCompleted: number;
}

export type ProgressListener = (event: ProgressEvent) => void;
