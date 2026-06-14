import { ProviderError } from "../errors.js";
import type { LlmCompletion } from "../llm/run.js";
import type { Usage } from "../provider.js";
import type { OpenAiCompletion } from "./types.js";

/** Parse the message content as JSON, rejecting unparseable content cleanly. */
function parseContent(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    throw new ProviderError("INVALID_RESPONSE", "The provider returned unparseable content.");
  }
}

/** Map OpenAI usage to our Usage shape, or undefined when not fully reported. */
function toUsage(usage: OpenAiCompletion["usage"]): Usage | undefined {
  if (usage === undefined) {
    return undefined;
  }
  const { prompt_tokens, completion_tokens } = usage;
  if (typeof prompt_tokens !== "number" || typeof completion_tokens !== "number") {
    return undefined;
  }
  return { inputTokens: prompt_tokens, outputTokens: completion_tokens };
}

/**
 * Extract schema-bound raw output from a Chat Completions response. A refusal is a
 * distinct, clean outcome surfaced as PROVIDER_REFUSED — never parsed as a
 * translation and never silently dropped. The returned raw object is validated
 * against the canonical schema by the shared layer (our side), regardless of any
 * SDK parsing. Errors here carry no key, header, or content.
 */
export function extractOpenAiResult(completion: OpenAiCompletion): LlmCompletion {
  const message = completion.choices[0]?.message;
  if (message === undefined) {
    throw new ProviderError("INVALID_RESPONSE", "The provider returned no message.");
  }
  if (message.refusal !== undefined && message.refusal !== null && message.refusal !== "") {
    throw new ProviderError("PROVIDER_REFUSED", "The provider refused the translation request.");
  }
  if (message.content === undefined || message.content === null) {
    throw new ProviderError("INVALID_RESPONSE", "The provider returned no translation content.");
  }
  const raw = parseContent(message.content);
  const usage = toUsage(completion.usage);
  return usage === undefined ? { raw } : { raw, usage };
}
