import Anthropic from "@anthropic-ai/sdk";
import { requireAnthropicKey } from "../env.js";
import type { BuiltRequest } from "./request.js";
import type { AnthropicCallOptions, AnthropicMessage, MessagesClient } from "./types.js";

/**
 * Build the production client wrapping the real @anthropic-ai/sdk. The only place
 * the SDK is constructed, keeping the rest of the package offline-testable via
 * {@link MessagesClient}. The explicit `logLevel: "off"` overrides ANTHROPIC_LOG so
 * the SDK never logs the x-api-key header.
 */
export function createDefaultClient(): MessagesClient {
  const sdk = new Anthropic({ apiKey: requireAnthropicKey(), logLevel: "off" });
  return {
    messages: {
      create: async (
        body: BuiltRequest,
        options?: AnthropicCallOptions,
      ): Promise<AnthropicMessage> =>
        (await sdk.messages.create(
          body as unknown as Anthropic.MessageCreateParamsNonStreaming,
          options,
        )) as unknown as AnthropicMessage,
    },
  };
}
