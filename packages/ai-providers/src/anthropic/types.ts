import type { BuiltRequest } from "./request.js";

/** The Anthropic message-create response, narrowed to the fields this provider reads. */
export interface AnthropicMessage {
  readonly content: readonly unknown[];
  readonly usage?: { readonly input_tokens?: number; readonly output_tokens?: number };
}

/**
 * The minimal client surface this provider depends on. Tests inject a stub so the
 * network is never touched; production wraps the real @anthropic-ai/sdk client.
 */
export interface MessagesClient {
  messages: { create(body: BuiltRequest): Promise<AnthropicMessage> };
}
