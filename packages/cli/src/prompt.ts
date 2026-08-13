import process from "node:process";
import { createInterface } from "node:readline/promises";

export function stdinIsTty(): boolean {
  return process.stdin.isTTY === true;
}

export async function askLine(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}
