const MIN_SOURCE_LENGTH = 8;

const MAX_LENGTH_MULTIPLE = 12;

const MAX_REPEAT_UNIT_LENGTH = 16;

const MIN_CONSECUTIVE_REPEATS = 8;

const REPEAT_COVERAGE_FRACTION = 0.5;

const MAX_SCAN_LENGTH = 8192;

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
