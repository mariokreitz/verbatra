/**
 * The fixed column layout shared by the builder and the reader, so write and read can never
 * drift on which column carries which field. v1 ships exactly this layout (no config).
 *
 * Columns, left to right:
 *  1 Key          - the dotted key path; the sole round-trip identity. Read-only, shaded.
 *  2 Source       - the source-locale value. Read-only, shaded.
 *  3 Current      - the existing target value, if any. Read-only, shaded.
 *  4 Status       - the diff bucket ("new" or "changed"). Read-only, shaded.
 *  5 Translation  - the only editable cell.
 *  6 Source hash  - the export-time source content hash. Hidden, read-only (drift detection).
 */

export const COLUMN = {
  key: 1,
  source: 2,
  current: 3,
  status: 4,
  translation: 5,
  sourceHash: 6,
} as const;

/** The header row labels, in column order. The reader matches the Key/Source-hash headers. */
export const HEADERS: readonly string[] = [
  "Key",
  "Source",
  "Current translation",
  "Status",
  "Translation",
  "Source hash",
];

/** The 1-based row index the header occupies; data rows start at the next row. */
export const HEADER_ROW = 1;

/** The worksheet name of the instructions sheet, excluded from the data-sheet scan on read. */
export const INSTRUCTIONS_SHEET_NAME = "Instructions";
