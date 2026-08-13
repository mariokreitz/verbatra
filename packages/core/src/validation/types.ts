export interface PlaceholderFinding {
  readonly key: string;
  readonly namespace: string;
  readonly locale: string;
  readonly missing: readonly string[];
  readonly extra: readonly string[];
  readonly reordered: boolean;
}
