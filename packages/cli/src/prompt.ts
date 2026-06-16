import process from "node:process";
import { createInterface } from "node:readline/promises";

// Thin I/O seam for the init prompts: a TTY check and a single line read. No decision logic lives
// here (interactive-vs-not, what to ask, defaults, and validation are in init.ts). Coverage-excluded
// like the other process-touching seams (index.ts), so the decision logic stays fully tested.

/** Whether standard input is an interactive terminal. */
export function stdinIsTty(): boolean {
  return process.stdin.isTTY === true;
}

/** Read one line from stdin for the given prompt and return it trimmed. */
export async function askLine(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}
