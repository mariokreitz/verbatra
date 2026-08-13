import { type FileHandle, open } from "node:fs/promises";
import { AdapterError } from "../errors.js";
import { MAX_INPUT_BYTES } from "./limits.js";

export type BoundedReadOutcome =
  | { readonly kind: "ok"; readonly content: string }
  | { readonly kind: "not-a-file" }
  | { readonly kind: "too-large" };

function stripLeadingBom(content: string): string {
  return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
}

async function readBoundedUtf8(handle: FileHandle, size: number): Promise<string> {
  const buffer = Buffer.allocUnsafe(size);
  let offset = 0;
  while (offset < size) {
    const { bytesRead } = await handle.read(buffer, offset, size - offset, offset);
    if (bytesRead === 0) {
      break;
    }
    offset += bytesRead;
  }
  return stripLeadingBom(buffer.toString("utf8", 0, offset));
}

export async function readBounded(filePath: string): Promise<BoundedReadOutcome> {
  const handle = await open(filePath, "r");
  try {
    const info = await handle.stat();
    if (!info.isFile()) {
      return { kind: "not-a-file" };
    }
    if (info.size > MAX_INPUT_BYTES) {
      return { kind: "too-large" };
    }
    return { kind: "ok", content: await readBoundedUtf8(handle, info.size) };
  } finally {
    await handle.close();
  }
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

export async function readFileContent(filePath: string): Promise<string> {
  const outcome = await readBounded(filePath);
  return outcomeToContent(outcome, "The path is not a regular file.");
}
