import type Anthropic from "@anthropic-ai/sdk";

/**
 * The Anthropic authoring model type, sourced from the SDK's own model union so verbatra
 * restates no model IDs. It is an open union (known literals plus `string & {}`), so unknown
 * or newly released model IDs are still accepted. Type-only: it informs editor completions
 * and is never validated at runtime, where the schema stays `z.string().min(1)`.
 */
export type AnthropicModel = Anthropic.Messages.Model;
