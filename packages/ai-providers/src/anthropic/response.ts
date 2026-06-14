import { ProviderError } from "../errors.js";
import { reconcileResult } from "../llm/response.js";
import { SUBMIT_TOOL_NAME } from "./request.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Find the forced tool-use block's input in the response content, or undefined. */
function extractToolInput(content: readonly unknown[]): unknown {
  for (const block of content) {
    if (isRecord(block) && block.type === "tool_use" && block.name === SUBMIT_TOOL_NAME) {
      return block.input;
    }
  }
  return undefined;
}

/**
 * Extract the forced tool-use input from the response, or reject when the model
 * returned no such block. This is the Anthropic-specific step; the schema
 * validation and key reconciliation are the shared layer's job.
 */
export function requireToolInput(content: readonly unknown[]): unknown {
  const raw = extractToolInput(content);
  if (raw === undefined) {
    throw new ProviderError("INVALID_RESPONSE", "The provider returned no translation output.");
  }
  return raw;
}

/**
 * Parse and validate the model output: extract the tool-use input, then validate
 * and reconcile it against the requested keys via the shared layer. Output is
 * treated strictly as data, never executed or interpreted.
 */
export function parseTranslations(
  content: readonly unknown[],
  requestedKeys: readonly string[],
): Map<string, string> {
  return reconcileResult(requireToolInput(content), requestedKeys);
}
