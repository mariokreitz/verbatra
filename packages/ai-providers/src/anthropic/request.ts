import { deriveJsonSchema, translationsResultSchema } from "../llm/schema.js";
import { SHARED_SYSTEM_RULES } from "../llm/system-rules.js";
import type { AnthropicConfig } from "./config.js";

/** The forced tool the model must call to return results. */
export const SUBMIT_TOOL_NAME = "submit_translations";

/**
 * Prompt-injection boundary: SYSTEM_RULES must stay a compile-time constant with no
 * variable ever spliced in, so untrusted input only ever reaches the data channel
 * (the user-turn JSON payload), never the instruction channel.
 */
export const SYSTEM_RULES = [
  ...SHARED_SYSTEM_RULES,
  `Return results only by calling the ${SUBMIT_TOOL_NAME} tool: exactly one entry per requested key, no commentary, no extra keys, and no key that was not requested.`,
].join("\n");

/** input_schema is derived from the canonical schema so the model constraint and the shared validation cannot diverge. */
const SUBMIT_TOOL = {
  name: SUBMIT_TOOL_NAME,
  description: "Submit the translated string for every requested key.",
  input_schema: deriveJsonSchema(translationsResultSchema),
};

/** The non-streaming Anthropic message-create body, narrowed to the fields used here. */
export interface BuiltRequest {
  readonly model: string;
  readonly max_tokens: number;
  readonly system: string;
  readonly messages: readonly [{ readonly role: "user"; readonly content: string }];
  readonly tools: readonly [typeof SUBMIT_TOOL];
  readonly tool_choice: { readonly type: "tool"; readonly name: string };
}

/**
 * Build the message-create body from the already-serialized data payload, forcing the
 * model to answer through the submit_translations tool so the output is schema-bound.
 */
export function buildRequest(config: AnthropicConfig, payloadJson: string): BuiltRequest {
  return {
    model: config.model,
    max_tokens: config.maxTokens,
    system: SYSTEM_RULES,
    messages: [{ role: "user", content: payloadJson }],
    tools: [SUBMIT_TOOL],
    tool_choice: { type: "tool", name: SUBMIT_TOOL_NAME },
  };
}
