export const COLUMN = {
  key: 1,
  source: 2,
  current: 3,
  status: 4,
  translation: 5,
  sourceHash: 6,
  context: 7,
  reviewStatus: 8,
  reviewReasons: 9,
} as const;

export const HEADERS: readonly string[] = [
  "Key",
  "Source",
  "Current translation",
  "Status",
  "Translation",
  "Source hash",
  "Context",
  "Review status",
  "Review reasons",
];

export const HEADER_ROW = 1;

export const INSTRUCTIONS_SHEET_NAME = "Instructions";
