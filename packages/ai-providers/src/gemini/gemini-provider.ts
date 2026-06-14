import { ProviderError } from "../errors.js";
import { type LlmCompletion, type LlmMechanism, runLlmTranslation } from "../llm/run.js";
import type { TranslateRequest, TranslateResult, TranslationProvider } from "../provider.js";
import { createDefaultClient } from "./client.js";
import { type GeminiConfig, geminiConfigSchema } from "./config.js";
import { buildGeminiRequest, type GeminiRequest } from "./request.js";
import { extractGeminiResult } from "./response.js";
import type { GeminiClient, GeminiResponse } from "./types.js";

const PROVIDER_ID = "gemini";

/** Optional dependencies, used by tests to inject a stub client (keeps tests offline). */
export interface GeminiDeps {
  readonly client?: GeminiClient;
}

/**
 * Create the Gemini LLM provider. Structured output via responseSchema is its
 * mechanism behind the shared layer's extension point; the model and output-token
 * limit come from config and the API key is read only from the environment (via the
 * default client).
 */
export function createGeminiProvider(
  config: GeminiConfig,
  deps: GeminiDeps = {},
): TranslationProvider {
  const validConfig = geminiConfigSchema.parse(config);
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

/** Gemini's mechanism: build the responseSchema request, call it, extract raw output. */
function createMechanism(client: GeminiClient, config: GeminiConfig): LlmMechanism {
  return {
    translate: async ({ payloadJson }): Promise<LlmCompletion> => {
      const request = buildGeminiRequest(config, payloadJson);
      const response = await callClient(client, request);
      return extractGeminiResult(response);
    },
  };
}

/** Call the provider, never re-throwing the raw SDK error (it can carry secrets). */
async function callClient(client: GeminiClient, request: GeminiRequest): Promise<GeminiResponse> {
  try {
    return await client.models.generateContent(request);
  } catch {
    throw new ProviderError("PROVIDER_ERROR", "The translation provider request failed.");
  }
}
