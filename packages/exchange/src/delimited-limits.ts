/**
 * Hard caps bounding the parse of an untrusted returned interchange file. They are the delimited
 * analogue of the xlsx caps, not a reuse of them: an interchange file is plain text with no container
 * to inflate, so what has to be bounded is the text itself (its size), how many records it claims, how
 * many fields one record claims, and how long one field is.
 */
export interface DelimitedLimits {
  /** Maximum size of the decoded input text, in UTF-8 bytes. */
  readonly maxInputBytes: number;
  /** Maximum number of data records (the header record is not counted). */
  readonly maxRowsPerFile: number;
  /** Maximum number of fields in one record. */
  readonly maxFieldsPerRow: number;
  /** Maximum length of one field, in UTF-16 code units. */
  readonly maxFieldLength: number;
}

/**
 * The default caps: generous for a real translator handoff yet far below the resource exhaustion a
 * crafted file would reach. `maxInputBytes` is the outer bound, so a single field or record can never
 * exceed it either, whatever the per-field and per-record caps allow.
 */
export const DEFAULT_DELIMITED_LIMITS: DelimitedLimits = {
  maxInputBytes: 32 * 1024 * 1024,
  maxRowsPerFile: 100_000,
  maxFieldsPerRow: 64,
  maxFieldLength: 1024 * 1024,
};
