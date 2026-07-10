import { ProviderError } from "../errors.js";
import type { LlmCompletion } from "../llm/run.js";
import { assertNotTruncated } from "../llm/truncation.js";
import type { Usage } from "../provider.js";
import type { OpenAiCompletion } from "./types.js";

interface StringScanState {
  readonly inString: boolean;
  readonly escaped: boolean;
}

/**
 * Advance the string-literal scan state by one character. Handles an escape sequence (`\\`, `\"`,
 * `\n`, `\uXXXX`, and so on) by treating the character right after a backslash as consumed without
 * inspecting it, and closes the string only on an unescaped `"`, so a quote, brace, or backslash
 * inside a JSON string value never terminates the string early or leaks into the caller's depth
 * count.
 */
function advanceStringScan(char: string | undefined, escaped: boolean): StringScanState {
  if (escaped) {
    return { inString: true, escaped: false };
  }
  if (char === "\\") {
    return { inString: true, escaped: true };
  }
  return { inString: char !== '"', escaped: false };
}

/**
 * Scan forward from `start` (which must point at a "{") for the index of its matching closing
 * brace, tracking depth while string-aware so quotes and braces inside JSON string values
 * (including escaped quotes and, notably, embedded Markdown fence characters such as a "```bash"
 * block quoted inside a translated string) never corrupt the depth count. Returns null when the
 * object is never closed, for example a truncated response.
 */
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

/**
 * Extract the first brace-balanced JSON object substring from arbitrary surrounding text that
 * itself parses as valid JSON. This makes surrounding prose or Markdown fences irrelevant, and the
 * fence characters need never be detected or stripped: the object is located structurally. When a
 * candidate object is well-balanced but not valid JSON (for example an illustrative, non-JSON
 * example block that precedes the real answer), scanning resumes after it so a later, genuinely
 * valid object is still found. Returns null when no balanced, parseable object exists anywhere in
 * the content, for example a truncated response.
 *
 * This function has no awareness of the translations schema: it returns the first candidate that
 * parses, nothing more. A model that emits a valid, schema-shaped example ahead of the real answer
 * (for instance a genuine few-shot illustration, as opposed to the non-JSON example above) would
 * have that example returned instead of the real answer. That is out of scope here: schema and
 * placeholder/ICU validation happen downstream in `runLlmTranslation`, and this parameter only
 * targets the tolerant local-model path, where the observed failure mode is malformed or
 * fence-wrapped output, not well-formed decoys.
 *
 * Known limitation: a single unbalanced `{` in prose that precedes the real JSON answer (for
 * example a model saying `Set locale to {de then:` before the fenced object) makes
 * {@link scanBalancedObjectEnd} treat the real object's own braces as nested inside that opened
 * scope. The scan never returns to depth 0, so extraction reports the object as never closed and
 * the whole call fails with `INVALID_RESPONSE`, even though a well-formed object follows later in
 * the content. This is accepted rather than fixed: recovering by rewinding into an unclosed
 * candidate and retrying from every later `{` would reintroduce a quadratic-time scan on
 * adversarial input, which the fail-fast-on-unclosed design here deliberately avoids.
 *
 * @param content - The raw message content, possibly wrapped in prose or Markdown fences.
 */
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

/**
 * Parse the message content as JSON.
 *
 * @param content - The raw message content.
 * @param tolerant - When true, the first brace-balanced JSON object anywhere in the content is
 *   extracted before parsing, for local models that wrap output in prose or Markdown fences despite
 *   being asked not to.
 */
function parseContent(content: string, tolerant: boolean): unknown {
  const candidate = tolerant ? (extractBalancedJson(content) ?? content) : content;
  try {
    return JSON.parse(candidate);
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
 * @param tolerant - When true, extract the first brace-balanced JSON object anywhere in the content
 *   before parsing, tolerating surrounding prose and Markdown fences. Defaults to false, the hosted
 *   OpenAI behavior, so this parameter's existence does not affect the hosted `openai` provider.
 * @returns The schema-bound raw output plus optional usage.
 * @throws {@link ProviderError} `OUTPUT_TRUNCATED`: the choice stopped on the output-token limit
 *   (`finish_reason === "length"`); checked before parsing, so a truncated-but-valid body still reports
 *   truncation.
 * @throws {@link ProviderError} `PROVIDER_REFUSED`: the model populated the refusal field.
 * @throws {@link ProviderError} `INVALID_RESPONSE`: there was no message, no content, or unparseable
 *   content (after brace-balanced extraction, when `tolerant` is true).
 */
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
  const usage = toUsage(completion.usage);
  return usage === undefined ? { raw } : { raw, usage };
}
