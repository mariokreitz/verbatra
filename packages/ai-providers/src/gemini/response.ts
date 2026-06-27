import { ProviderError } from "../errors.js";
import type { LlmCompletion } from "../llm/run.js";
import { assertNotTruncated } from "../llm/truncation.js";
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

function parseContent(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderError("INVALID_RESPONSE", "The provider returned unparseable content.");
  }
}

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
 * Extract schema-bound raw output from a generateContent response. Blocked, empty, or
 * safety-filtered results surface as PROVIDER_BLOCKED and a MAX_TOKENS truncation as
 * OUTPUT_TRUNCATED, both checked before the text is read so a truncated-but-valid body
 * still reports truncation. Errors here carry no key, header, or content.
 *
 * @param response - The raw generateContent response.
 * @returns The schema-bound raw output plus optional usage.
 * @throws {@link ProviderError} `PROVIDER_BLOCKED`: the prompt was blocked, there was no candidate, or the
 *   candidate was safety-filtered.
 * @throws {@link ProviderError} `OUTPUT_TRUNCATED`: the candidate stopped on the output-token limit
 *   (`MAX_TOKENS`).
 * @throws {@link ProviderError} `INVALID_RESPONSE`: the content was empty or unparseable.
 */
export function extractGeminiResult(response: GeminiResponse): LlmCompletion {
  // An empty-string blockReason means not blocked: only a present, non-empty reason
  // indicates the prompt was actually blocked.
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
  assertNotTruncated(candidate.finishReason === "MAX_TOKENS");
  const text = response.text;
  if (text === undefined || text === "") {
    throw new ProviderError("INVALID_RESPONSE", "The provider returned no translation content.");
  }
  const raw = parseContent(text);
  const usage = toUsage(response.usageMetadata);
  return usage === undefined ? { raw } : { raw, usage };
}
