import { CliUsageError } from "./cli-usage-error.js";

/** What a positive-integer flag is checked and reported as. */
export interface PositiveIntegerOptionSpec {
  /** The stable {@link CliUsageError} code thrown when `value` fails validation. */
  readonly code: string;
  /** The flag and unit, inserted as `The ${describe}, got "<value>".`. */
  readonly describe: string;
  /** The smallest integer `value` may parse to (inclusive). */
  readonly min: number;
}

/**
 * Parses a CLI flag value expected to be a bare positive integer string. An omitted flag (`undefined`)
 * stays `undefined`, leaving the caller's own default in force. A given value must match `/^\d+$/` and
 * be at least `spec.min`; anything else (non-numeric, a decimal, a unit suffix, or below the minimum)
 * is a usage error, never a silent fallback to a default.
 *
 * @throws {@link CliUsageError} `spec.code` when `value` is not an integer string >= `spec.min`.
 */
export function parsePositiveIntegerOption(
  value: string | undefined,
  spec: PositiveIntegerOptionSpec,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (!/^\d+$/.test(value) || parsed < spec.min) {
    throw new CliUsageError(spec.code, `The ${spec.describe}, got "${value}".`);
  }
  return parsed;
}
