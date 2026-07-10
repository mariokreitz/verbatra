import OpenAI from "openai";
import { resolveOpenAiCompatibleKey } from "../env.js";
import type { OpenAiRequest } from "../openai/request.js";
import type { OpenAiCallOptions, OpenAiClient, OpenAiCompletion } from "../openai/types.js";
import type { OpenAiCompatibleConfig } from "./config.js";

/**
 * Build the production client for a local or self-hosted OpenAI-compatible server, pointed at the
 * configured `baseUrl`.
 *
 * Structurally isolated from the hosted `openai` provider's client (see the ADR's "hosted key can never
 * reach a custom baseUrl" guarantee): this always resolves its own key via
 * {@link resolveOpenAiCompatibleKey}, never `requireOpenAiKey`, and never reads `OPENAI_API_KEY`. It
 * always passes an explicit `apiKey` (a real key, a named-variable key, or the `"local"` placeholder),
 * so the openai SDK's own fallback to `process.env.OPENAI_API_KEY` is suppressed by construction, not by
 * convention.
 *
 * logLevel "off" is set explicitly, same as the hosted client, closing the request-logging key-leak path.
 */
export function createDefaultClient(config: OpenAiCompatibleConfig): OpenAiClient {
  const sdk = new OpenAI({
    apiKey: resolveOpenAiCompatibleKey(config.apiKeyEnvVar),
    baseURL: config.baseUrl,
    logLevel: "off",
  });
  return {
    chat: {
      completions: {
        create: async (
          body: OpenAiRequest,
          options?: OpenAiCallOptions,
        ): Promise<OpenAiCompletion> =>
          (await sdk.chat.completions.create(
            body as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
            options,
          )) as unknown as OpenAiCompletion,
      },
    },
  };
}
