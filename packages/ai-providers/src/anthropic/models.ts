import type Anthropic from "@anthropic-ai/sdk";

/**
 * The Anthropic authoring model type, sourced from the SDK's own model union. It is an
 * open union (known literals plus `string & {}`), so unknown or newly released model IDs
 * are still accepted. This drives editor completions only; the runtime schema validates.
 */
export type AnthropicModel = Anthropic.Messages.Model;
