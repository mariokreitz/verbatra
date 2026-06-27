import OpenAI from "openai";
import { requireOpenAiKey } from "../env.js";
import type { OpenAiRequest } from "./request.js";
import type { OpenAiClient, OpenAiCompletion } from "./types.js";

/**
 * Build the production client by wrapping the real openai SDK.
 *
 * logLevel "off" is set explicitly so an explicit value takes precedence over
 * OPENAI_LOG in the SDK, closing the request-logging key-leak path.
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
