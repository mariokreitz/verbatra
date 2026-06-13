import Anthropic from "@anthropic-ai/sdk";
import { requireApiKey } from "../env.js";
import type { BuiltRequest } from "./request.js";
import type { AnthropicMessage, MessagesClient } from "./types.js";

/**
 * Build the production client by wrapping the real @anthropic-ai/sdk. The SDK type
 * coupling is confined to this one adapter; the casts localize the boundary between
 * our narrowed BuiltRequest/AnthropicMessage and the SDK's parameter/return types.
 * This module is the only place the SDK is constructed, so the rest of the package
 * stays offline-testable through MessagesClient.
 */
export function createDefaultClient(): MessagesClient {
  // logLevel "off" is set explicitly so the SDK's own request logging stays
  // silent even if an operator sets ANTHROPIC_LOG=debug. At debug level the SDK
  // logs request details including the x-api-key header; an explicit logLevel
  // takes precedence over the ANTHROPIC_LOG env var in the SDK, closing that
  // key-leak path structurally rather than by convention.
  const sdk = new Anthropic({ apiKey: requireApiKey(), logLevel: "off" });
  return {
    messages: {
      create: async (body: BuiltRequest): Promise<AnthropicMessage> =>
        (await sdk.messages.create(
          body as unknown as Anthropic.MessageCreateParamsNonStreaming,
        )) as unknown as AnthropicMessage,
    },
  };
}
