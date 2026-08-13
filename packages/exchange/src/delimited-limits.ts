export interface DelimitedLimits {
  readonly maxInputBytes: number;
  readonly maxRowsPerFile: number;
  readonly maxFieldsPerRow: number;
  readonly maxFieldLength: number;
}

export const DEFAULT_DELIMITED_LIMITS: DelimitedLimits = {
  maxInputBytes: 32 * 1024 * 1024,
  maxRowsPerFile: 100_000,
  maxFieldsPerRow: 64,
  maxFieldLength: 1024 * 1024,
};
