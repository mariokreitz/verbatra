import { ProviderError } from "../errors.js";
import type { LlmCompletion } from "../llm/run.js";
import { assertNotTruncated } from "../llm/truncation.js";
import type { Usage } from "../provider.js";
import type { OpenAiCompletion } from "./types.js";

function parseContent(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    throw new ProviderError("INVALID_RESPONSE", "The provider returned unparseable content.");
  }
}

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
 * Extract schema-bound raw output from a Chat Completions response. A refusal is
 * surfaced as PROVIDER_REFUSED, never parsed as a translation. Errors raised here
 * carry no key, header, or content.
 *
 * @param completion - The raw Chat Completions response.
 * @returns The schema-bound raw output plus optional usage.
 * @throws {@link ProviderError} `OUTPUT_TRUNCATED`: the choice stopped on the output-token limit
 *   (`finish_reason === "length"`); checked before parsing, so a truncated-but-valid body still reports
 *   truncation.
 * @throws {@link ProviderError} `PROVIDER_REFUSED`: the model populated the refusal field.
 * @throws {@link ProviderError} `INVALID_RESPONSE`: there was no message, no content, or unparseable
 *   content.
 */
export function extractOpenAiResult(completion: OpenAiCompletion): LlmCompletion {
  const choice = completion.choices[0];
  if (choice === undefined) {
    throw new ProviderError("INVALID_RESPONSE", "The provider returned no message.");
  }
  assertNotTruncated(choice.finish_reason === "length");
  const message = choice.message;
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
