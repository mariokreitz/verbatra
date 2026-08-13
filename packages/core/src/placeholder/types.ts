export interface PlaceholderIntegrityResult {
  readonly matches: boolean;
  readonly missing: readonly string[];
  readonly extra: readonly string[];
  readonly reordered: boolean;
}
