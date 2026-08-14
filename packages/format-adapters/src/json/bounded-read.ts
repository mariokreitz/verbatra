import { AdapterError } from "../errors.js";
import type { AdapterFs, BoundedReadOutcome } from "../fs-port.js";
import { MAX_INPUT_BYTES } from "./limits.js";

function stripLeadingBom(content: string): string {
  return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
}

export async function readBoundedFile(
  fs: AdapterFs,
  filePath: string,
): Promise<BoundedReadOutcome> {
  const outcome = await fs.readBounded(filePath, MAX_INPUT_BYTES);
  return outcome.kind === "ok"
    ? { kind: "ok", content: stripLeadingBom(outcome.content) }
    : outcome;
}

export function outcomeToContent(outcome: BoundedReadOutcome, notAFileMessage: string): string {
  if (outcome.kind === "not-a-file") {
    throw new AdapterError("INVALID_STRUCTURE", notAFileMessage);
  }
  if (outcome.kind === "too-large") {
    throw new AdapterError("INPUT_TOO_LARGE", "The file exceeds the maximum allowed size.");
  }
  return outcome.content;
}

export async function readFileContent(fs: AdapterFs, filePath: string): Promise<string> {
  const outcome = await readBoundedFile(fs, filePath);
  return outcomeToContent(outcome, "The path is not a regular file.");
}
