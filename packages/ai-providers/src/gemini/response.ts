import { ProviderError } from "../errors.js";
import type { LlmCompletion } from "../llm/run.js";
import type { Usage } from "../provider.js";
import type { GeminiResponse } from "./types.js";

/** Candidate finish reasons that indicate the response was filtered/blocked. */
const BLOCKED_FINISH_REASONS = new Set([
  "SAFETY",
  "RECITATION",
  "BLOCKLIST",
  "PROHIBITED_CONTENT",
  "IMAGE_SAFETY",
  "SPII",
]);

/** Parse the response text as JSON, rejecting unparseable content cleanly. */
function parseContent(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderError("INVALID_RESPONSE", "The provider returned unparseable content.");
  }
}

/** Map Gemini usage to our Usage shape, or undefined when not fully reported. */
function toUsage(usage: GeminiResponse["usageMetadata"]): Usage | undefined {
  if (usage === undefined) {
    return undefined;
  }
  const { promptTokenCount, candidatesTokenCount } = usage;
  if (typeof promptTokenCount !== "number" || typeof candidatesTokenCount !== "number") {
    return undefined;
  }
  return { inputTokens: promptTokenCount, outputTokens: candidatesTokenCount };
}

/**
 * Extract schema-bound raw output from a generateContent response. A blocked, empty,
 * or safety-filtered result is a distinct, clean outcome surfaced as PROVIDER_BLOCKED
 * — never parsed as a translation and never silently dropped. Blocked reasons are
 * checked BEFORE reading the text, so the SDK's non-STOP text warning is never
 * reached on a blocked result. A token-limit truncation (MAX_TOKENS) is not a block:
 * its incomplete text falls through to the shared validation as INVALID_RESPONSE. The
 * raw object is validated against the canonical schema by the shared layer. Errors
 * here carry no key, header, or content.
 */
export function extractGeminiResult(response: GeminiResponse): LlmCompletion {
  // An empty-string blockReason is treated as "not blocked": only a present,
  // non-empty reason indicates the prompt was actually blocked (see the test fixture
  // in gemini/response.test.ts).
  const blockReason = response.promptFeedback?.blockReason;
  if (blockReason !== undefined && blockReason !== "") {
    throw new ProviderError("PROVIDER_BLOCKED", "The provider blocked the translation request.");
  }
  const candidate = response.candidates?.[0];
  if (candidate === undefined) {
    throw new ProviderError("PROVIDER_BLOCKED", "The provider returned no candidate.");
  }
  if (candidate.finishReason !== undefined && BLOCKED_FINISH_REASONS.has(candidate.finishReason)) {
    throw new ProviderError("PROVIDER_BLOCKED", "The provider filtered the translation response.");
  }
  const text = response.text;
  if (text === undefined || text === "") {
    throw new ProviderError("INVALID_RESPONSE", "The provider returned no translation content.");
  }
  const raw = parseContent(text);
  const usage = toUsage(response.usageMetadata);
  return usage === undefined ? { raw } : { raw, usage };
}
