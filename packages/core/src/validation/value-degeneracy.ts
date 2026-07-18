/** A trimmed source shorter than this (in UTF-16 code units) exempts the length-ratio signal only. */
const MIN_SOURCE_LENGTH = 8;

/**
 * The candidate is degenerate when its trimmed length reaches this multiple of the trimmed source
 * length. Set high on purpose: a legitimate expansion (a dense CJK source unfolding into a verbose
 * target) stays well under it, so only a runaway output trips this signal.
 */
const MAX_LENGTH_MULTIPLE = 12;

/** The longest repeated unit the repetition scan considers, long enough to catch phrase-level loops. */
const MAX_REPEAT_UNIT_LENGTH = 16;

/** The fewest back-to-back copies of one unit that count as a runaway loop. */
const MIN_CONSECUTIVE_REPEATS = 8;

/** A repeated run must span at least this fraction of the scanned prefix to count, so an embedded number or a doubled word is ignored. */
const REPEAT_COVERAGE_FRACTION = 0.5;

/**
 * The repetition scan never looks past this many code units of the candidate. Translatable values
 * are untrusted and uncapped, so a bounded prefix keeps the scan cheap on adversarial input: a
 * runaway loop reveals itself within the prefix, and a legitimate value longer than the cap is
 * simply not scanned past it, a deliberately conservative (false-negative) tradeoff.
 */
const MAX_SCAN_LENGTH = 8192;

/** The structural verdict {@link assessValueDegeneracy} returns for one candidate value. */
export interface ValueDegeneracyAssessment {
  readonly degenerate: boolean;
}

function matchesUnit(text: string, a: number, b: number, unit: number): boolean {
  for (let i = 0; i < unit; i++) {
    if (text[a + i] !== text[b + i]) {
      return false;
    }
  }
  return true;
}

function countConsecutiveCopies(
  text: string,
  start: number,
  unit: number,
  scanLength: number,
): number {
  let copies = 1;
  let next = start + unit;
  while (next + unit <= scanLength && matchesUnit(text, start, next, unit)) {
    copies++;
    next += unit;
  }
  return copies;
}

function hasDominantRun(text: string, scanLength: number, unit: number, coverage: number): boolean {
  const limit = scanLength - unit;
  let start = 0;
  while (start <= limit) {
    const copies = countConsecutiveCopies(text, start, unit, scanLength);
    if (copies >= MIN_CONSECUTIVE_REPEATS && copies * unit >= coverage) {
      return true;
    }
    start += copies * unit;
  }
  return false;
}

function hasRunawayRepetition(text: string): boolean {
  const scanLength = Math.min(text.length, MAX_SCAN_LENGTH);
  const coverage = scanLength * REPEAT_COVERAGE_FRACTION;
  const maxUnit = Math.min(
    MAX_REPEAT_UNIT_LENGTH,
    Math.floor(scanLength / MIN_CONSECUTIVE_REPEATS),
  );
  for (let unit = 1; unit <= maxUnit; unit++) {
    if (hasDominantRun(text, scanLength, unit, coverage)) {
      return true;
    }
  }
  return false;
}

/**
 * Structural, language- and CJK-agnostic check for a degenerate machine translation: an output a
 * placeholder and ICU gate would wave through (it has no placeholders and parses fine) but that is
 * plainly corrupt, such as a repetition loop like `"error: error: error: ..."`. Deliberately
 * conservative (it favors false negatives over false positives) so it is safe to apply to any
 * origin, provider output, a human edit, or a workbook import, with no origin flag: it never fires
 * on plausible human input.
 *
 * A candidate is degenerate when either signal trips, both measured on the trimmed values.
 * The length signal: the candidate reaches {@link MAX_LENGTH_MULTIPLE} times the source length; it
 * needs the source as a baseline, so it is skipped when the trimmed source is shorter than
 * {@link MIN_SOURCE_LENGTH}. The repetition signal: a short unit (up to
 * {@link MAX_REPEAT_UNIT_LENGTH} code units) repeats back to back at least
 * {@link MIN_CONSECUTIVE_REPEATS} times and that run spans at least
 * {@link REPEAT_COVERAGE_FRACTION} of the scanned prefix; it runs regardless of source length (a
 * short candidate cannot reach the repeat floor, so this adds no false positives) but never looks
 * past {@link MAX_SCAN_LENGTH} code units of the candidate.
 *
 * @param sourceValue - The source-locale value the candidate is a translation of.
 * @param candidateValue - The candidate translated value to assess.
 * @returns Whether the candidate is structurally degenerate.
 */
export function assessValueDegeneracy(
  sourceValue: string,
  candidateValue: string,
): ValueDegeneracyAssessment {
  const source = sourceValue.trim();
  const candidate = candidateValue.trim();
  if (
    source.length >= MIN_SOURCE_LENGTH &&
    candidate.length >= source.length * MAX_LENGTH_MULTIPLE
  ) {
    return { degenerate: true };
  }
  return { degenerate: hasRunawayRepetition(candidate) };
}
