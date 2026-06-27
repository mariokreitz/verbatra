import Anthropic from "@anthropic-ai/sdk";
import { requireAnthropicKey } from "../env.js";
import type { BuiltRequest } from "./request.js";
import type { AnthropicMessage, MessagesClient } from "./types.js";

/**
 * Build the production client wrapping the real @anthropic-ai/sdk. The only place
 * the SDK is constructed, keeping the rest of the package offline-testable via
 * {@link MessagesClient}.
 */
export function createDefaultClient(): MessagesClient {
  // Explicit logLevel "off" overrides ANTHROPIC_LOG so the SDK never logs the x-api-key header.
  const sdk = new Anthropic({ apiKey: requireAnthropicKey(), logLevel: "off" });
  return {
    messages: {
      create: async (body: BuiltRequest): Promise<AnthropicMessage> =>
        (await sdk.messages.create(
          body as unknown as Anthropic.MessageCreateParamsNonStreaming,
        )) as unknown as AnthropicMessage,
    },
  };
}
