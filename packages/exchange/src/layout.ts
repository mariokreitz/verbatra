/**
 * The fixed column layout shared by the builder and the reader so they cannot drift on which column
 * carries which field. Columns, left to right: Key (the round-trip identity), Source, Current (the
 * existing target), Status ("new", "changed", or "unchanged"), Translation (the only editable cell),
 * Source hash (the export-time source hash, hidden, used for drift detection), and Context (read-only
 * developer context, appended last rather than inserted so the editable Translation column keeps its
 * position for anyone scripting against the workbook shape).
 */
export const COLUMN = {
  key: 1,
  source: 2,
  current: 3,
  status: 4,
  translation: 5,
  sourceHash: 6,
  context: 7,
} as const;

/** The header row labels, in column order. The reader matches the Key/Source-hash headers. */
export const HEADERS: readonly string[] = [
  "Key",
  "Source",
  "Current translation",
  "Status",
  "Translation",
  "Source hash",
  "Context",
];

/** The 1-based row index the header occupies; data rows start at the next row. */
export const HEADER_ROW = 1;

/** The worksheet name of the instructions sheet, excluded from the data-sheet scan on read. */
export const INSTRUCTIONS_SHEET_NAME = "Instructions";
