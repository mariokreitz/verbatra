export interface TranslationMemory {
  readonly version: number;
  readonly entries: Readonly<
    Record<string, Readonly<Record<string, Readonly<Record<string, string>>>>>
  >;
}

export interface CacheAddition {
  readonly contentHash: string;
  readonly value: string;
}
