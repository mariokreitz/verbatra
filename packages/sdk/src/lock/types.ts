export interface LockFile {
  readonly version: number;
  readonly locales: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

export type LockEntries = Readonly<Record<string, string>>;
