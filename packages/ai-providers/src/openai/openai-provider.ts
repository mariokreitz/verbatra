import { guardProviderCall } from "../guard.js";
import { type LlmMechanism, runLlmTranslation } from "../llm/run.js";
import type { TranslateRequest, TranslateResult, TranslationProvider } from "../provider.js";
import { createDefaultClient } from "./client.js";
import { type OpenAiConfig, openAiConfigSchema } from "./config.js";
import { buildOpenAiRequest, type OpenAiRequest } from "./request.js";
import { extractOpenAiResult } from "./response.js";
import type { OpenAiClient, OpenAiCompletion } from "./types.js";

const PROVIDER_ID = "openai";

/** Optional dependencies, used by tests to inject a stub client (keeps tests offline). */
export interface OpenAiDeps {
  readonly client?: OpenAiClient;
}

/**
 * Create the OpenAI LLM provider. Structured Outputs is its mechanism behind the
 * shared layer's extension point; the model and output-token limit come from config
 * and the API key is read only from the environment (via the default client).
 */
export function createOpenAiProvider(
  config: OpenAiConfig,
  deps: OpenAiDeps = {},
): TranslationProvider {
  const validConfig = openAiConfigSchema.parse(config);
  const client = deps.client ?? createDefaultClient();
  const mechanism = createMechanism(client, validConfig);
  return {
    id: PROVIDER_ID,
    kind: "llm",
    supportsGlossary: true,
    translateBatch: (request: TranslateRequest): Promise<TranslateResult> =>
      runLlmTranslation(request, mechanism),
  };
}

/** OpenAI's mechanism: build the Structured Outputs request, call it, extract raw output. */
function createMechanism(client: OpenAiClient, config: OpenAiConfig): LlmMechanism {
  return {
    translate: async ({ payloadJson }): Promise<ReturnType<typeof extractOpenAiResult>> => {
      const body = buildOpenAiRequest(config, payloadJson);
      const completion = await callClient(client, body);
      return extractOpenAiResult(completion);
    },
  };
}

/** Call the provider through the shared guard so a raw SDK error never leaks. */
function callClient(client: OpenAiClient, body: OpenAiRequest): Promise<OpenAiCompletion> {
  return guardProviderCall(() => client.chat.completions.create(body));
}
