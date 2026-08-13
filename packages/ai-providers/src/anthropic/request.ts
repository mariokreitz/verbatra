import { deriveJsonSchema, translationsResultSchema } from "../llm/schema.js";
import { SHARED_SYSTEM_RULES } from "../llm/system-rules.js";
import type { AnthropicConfig } from "./config.js";

export const SUBMIT_TOOL_NAME = "submit_translations";

export const SYSTEM_RULES = [
  ...SHARED_SYSTEM_RULES,
  `Return results only by calling the ${SUBMIT_TOOL_NAME} tool: exactly one entry per requested key, no commentary, no extra keys, and no key that was not requested.`,
].join("\n");

const SUBMIT_TOOL = {
  name: SUBMIT_TOOL_NAME,
  description: "Submit the translated string for every requested key.",
  input_schema: deriveJsonSchema(translationsResultSchema),
};

export interface BuiltRequest {
  readonly model: string;
  readonly max_tokens: number;
  readonly system: string;
  readonly messages: readonly [{ readonly role: "user"; readonly content: string }];
  readonly tools: readonly [typeof SUBMIT_TOOL];
  readonly tool_choice: { readonly type: "tool"; readonly name: string };
}

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
