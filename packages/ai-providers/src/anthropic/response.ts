import { ProviderError } from "../errors.js";
import { SUBMIT_TOOL_NAME } from "./request.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractToolInput(content: readonly unknown[]): unknown {
  for (const block of content) {
    if (isRecord(block) && block.type === "tool_use" && block.name === SUBMIT_TOOL_NAME) {
      return block.input;
    }
  }
  return undefined;
}

export function requireToolInput(content: readonly unknown[]): unknown {
  const raw = extractToolInput(content);
  if (raw === undefined) {
    throw new ProviderError("INVALID_RESPONSE", "The provider returned no translation output.");
  }
  return raw;
}
