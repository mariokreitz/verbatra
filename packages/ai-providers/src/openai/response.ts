import { ProviderError } from "../errors.js";
import type { LlmCompletion } from "../llm/run.js";
import { assertNotTruncated } from "../llm/truncation.js";
import { toUsage } from "../llm/usage.js";
import type { OpenAiCompletion } from "./types.js";

interface StringScanState {
  readonly inString: boolean;
  readonly escaped: boolean;
}

function advanceStringScan(char: string | undefined, escaped: boolean): StringScanState {
  if (escaped) {
    return { inString: true, escaped: false };
  }
  if (char === "\\") {
    return { inString: true, escaped: true };
  }
  return { inString: char !== '"', escaped: false };
}

function scanBalancedObjectEnd(content: string, start: number): number | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < content.length; i += 1) {
    const char = content[i];
    if (inString) {
      ({ inString, escaped } = advanceStringScan(char, escaped));
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }
  return null;
}

function extractBalancedJson(content: string): string | null {
  let searchFrom = 0;
  while (searchFrom < content.length) {
    const start = content.indexOf("{", searchFrom);
    if (start === -1) {
      return null;
    }
    const end = scanBalancedObjectEnd(content, start);
    if (end === null) {
      return null;
    }
    const candidate = content.slice(start, end + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      searchFrom = end + 1;
    }
  }
  return null;
}

function parseContent(content: string, tolerant: boolean): unknown {
  const candidate = tolerant ? (extractBalancedJson(content) ?? content) : content;
  try {
    return JSON.parse(candidate);
  } catch {
    throw new ProviderError("INVALID_RESPONSE", "The provider returned unparseable content.");
  }
}

export function extractOpenAiResult(completion: OpenAiCompletion, tolerant = false): LlmCompletion {
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
  const raw = parseContent(message.content, tolerant);
  const usage = toUsage(completion.usage?.prompt_tokens, completion.usage?.completion_tokens);
  return usage === undefined ? { raw } : { raw, usage };
}
