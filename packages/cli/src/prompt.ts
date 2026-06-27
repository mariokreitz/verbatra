import process from "node:process";
import { createInterface } from "node:readline/promises";

/**
 * Thin I/O seam for the init prompts: a TTY check and a single line read. The decision logic lives in
 * init.ts and is unit-tested there; this isolated, coverage-excluded boundary holds the unmockable
 * readline/stdin calls.
 *
 * @packageDocumentation
 */

/**
 * Whether standard input is an interactive terminal.
 *
 * @returns True when stdin is a TTY (so init may prompt); false under a pipe or in CI.
 */
export function stdinIsTty(): boolean {
  return process.stdin.isTTY === true;
}

/**
 * Read one line from stdin for the given prompt.
 *
 * @param question - The prompt text shown before the line is read.
 * @returns The entered line, trimmed (an empty string if the user just pressed enter).
 */
export async function askLine(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}
