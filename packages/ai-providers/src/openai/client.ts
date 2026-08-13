import OpenAI from "openai";
import { requireOpenAiKey } from "../env.js";
import { toMutableRequest } from "../llm/mutable.js";
import type { OpenAiRequest } from "./request.js";
import type { OpenAiCallOptions, OpenAiClient, OpenAiCompletion } from "./types.js";

export function createDefaultClient(): OpenAiClient {
  const sdk = new OpenAI({ apiKey: requireOpenAiKey(), logLevel: "off" });
  return {
    chat: {
      completions: {
        create: async (
          body: OpenAiRequest,
          options?: OpenAiCallOptions,
        ): Promise<OpenAiCompletion> =>
          (await sdk.chat.completions.create(
            toMutableRequest(body),
            options,
          )) as unknown as OpenAiCompletion,
      },
    },
  };
}
