import { CliUsageError } from "./cli-usage-error.js";

export interface PositiveIntegerOptionSpec {
  readonly code: string;
  readonly describe: string;
  readonly min: number;
}

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
