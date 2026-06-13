import { z } from "zod";
import { ProviderError } from "../errors.js";
import { SUBMIT_TOOL_NAME } from "./request.js";

/** The exact shape the forced tool must return: a key/value pair per requested key. */
const toolInputSchema = z.object({
  translations: z.array(z.object({ key: z.string(), value: z.string() })),
});

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
 * Reconcile the returned translations against the requested keys: reject any extra
 * key, any duplicate key, and any missing key. The result is a complete map keyed by
 * the original entry keys (key-in equals key-out).
 */
function reconcile(
  translations: readonly { readonly key: string; readonly value: string }[],
  requestedKeys: readonly string[],
): Map<string, string> {
  const requested = new Set(requestedKeys);
  const values = new Map<string, string>();
  for (const { key, value } of translations) {
    if (!requested.has(key) || values.has(key)) {
      throw new ProviderError(
        "INVALID_RESPONSE",
        "The provider returned an unexpected or duplicate key.",
      );
    }
    values.set(key, value);
  }
  if (values.size !== requested.size) {
    throw new ProviderError(
      "INVALID_RESPONSE",
      "The provider response is missing one or more keys.",
    );
  }
  return values;
}

/**
 * Parse and validate the model output. The output is treated strictly as data: the
 * tool-use input is schema-validated and reconciled with the requested keys, never
 * executed or interpreted. Any unparseable, wrong-shaped, extra-, duplicate-, or
 * missing-key response is rejected with a structured error.
 */
export function parseTranslations(
  content: readonly unknown[],
  requestedKeys: readonly string[],
): Map<string, string> {
  const raw = extractToolInput(content);
  if (raw === undefined) {
    throw new ProviderError("INVALID_RESPONSE", "The provider returned no translation output.");
  }
  const parsed = toolInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ProviderError(
      "INVALID_RESPONSE",
      "The provider returned a malformed translation payload.",
    );
  }
  return reconcile(parsed.data.translations, requestedKeys);
}
