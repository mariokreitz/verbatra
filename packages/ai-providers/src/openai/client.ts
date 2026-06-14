import OpenAI from "openai";
import { requireOpenAiKey } from "../env.js";
import type { OpenAiRequest } from "./request.js";
import type { OpenAiClient, OpenAiCompletion } from "./types.js";

/**
 * Build the production client by wrapping the real openai SDK. The SDK type
 * coupling is confined to this one adapter. logLevel "off" is set explicitly so the
 * SDK's own request logging stays silent even if an operator sets OPENAI_LOG=debug;
 * an explicit logLevel takes precedence over the OPENAI_LOG env var in the SDK,
 * closing that key-leak path structurally. This module is the only place the SDK is
 * constructed, so the rest of the package stays offline-testable through OpenAiClient.
 */
export function createDefaultClient(): OpenAiClient {
  const sdk = new OpenAI({ apiKey: requireOpenAiKey(), logLevel: "off" });
  return {
    chat: {
      completions: {
        create: async (body: OpenAiRequest): Promise<OpenAiCompletion> =>
          (await sdk.chat.completions.create(
            body as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
          )) as unknown as OpenAiCompletion,
      },
    },
  };
}
