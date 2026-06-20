/**
 * The plain-language instructions sheet content. v1 ships this fixed text (no config). It tells
 * a non-technical translator which column to fill, what not to touch, how to treat placeholders
 * and ICU, and what the status values mean.
 */
export const INSTRUCTIONS_LINES: readonly string[] = [
  "How to use this workbook",
  "",
  "1. There is one sheet per language. Open the sheet named for the language you are translating.",
  "2. Fill ONLY the 'Translation' column. Leave every other column unchanged.",
  "3. An empty 'Translation' cell means 'not translated yet'. It is skipped, never written as an empty string.",
  "4. Keep placeholders exactly as they appear. A token such as {name} or {count} must stay verbatim,",
  "   in your translation, with the same spelling. Do not translate or remove it.",
  "5. For ICU messages (for example {count, plural, one {# item} other {# items}}), keep the ICU",
  "   structure and the argument names exactly. Translate only the human-readable text.",
  "6. Do not edit the 'Key' column or the hidden 'Source hash' column. They map your translation",
  "   back to the right string. You may sort or filter rows freely; mapping does not depend on row order.",
  "",
  "Status values:",
  "  new      - this string has no translation yet.",
  "  changed  - the source string changed and the translation needs updating.",
  "",
  "When you are done, save the file and send it back. verbatra checks every value on import:",
  "a value with a broken placeholder, invalid ICU, or a source that changed since export is",
  "withheld (not written) and reported so you can fix and resubmit it.",
];
