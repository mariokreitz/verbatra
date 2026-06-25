import { guardProviderCall } from "../guard.js";
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
  /** A stub client; when omitted, the production client is built and reads the env key. */
  readonly client?: GeminiClient;
}

/**
 * Create the Gemini LLM provider. Structured output via responseSchema is its
 * mechanism behind the shared layer's extension point; the model and output-token
 * limit come from config and the API key is read only from the environment (via the
 * default client).
 *
 * @param config - The model and output-token limit; never a key.
 * @param deps - Optional injected client; when omitted, the production client is built.
 * @returns A {@link TranslationProvider}. Its `translateBatch` raises {@link ProviderError}
 *   `INVALID_REQUEST`, `INVALID_RESPONSE`, `OUTPUT_TRUNCATED` (a MAX_TOKENS-truncated completion, surfaced
 *   as an actionable truncation rather than a block), `PROVIDER_BLOCKED` (a safety block, no candidate, or
 *   filtered output), or `PROVIDER_ERROR`, never `PROVIDER_REFUSED`.
 * @throws A `ZodError` if `config` is invalid.
 * @throws {@link ProviderError} `MISSING_API_KEY`: at construction, when no client is injected and
 *   `GEMINI_API_KEY` is unset (the default client reads the env key eagerly).
 * @example
 * ```ts
 * // The key is read from GEMINI_API_KEY in the environment; it is never passed here.
 * const provider = createGeminiProvider({ model: "gemini-2.5-flash", maxOutputTokens: 1024 });
 * const result = await provider.translateBatch(request);
 * ```
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

/** Call the provider through the shared guard so a raw SDK error never leaks. */
function callClient(client: GeminiClient, request: GeminiRequest): Promise<GeminiResponse> {
  return guardProviderCall(() => client.models.generateContent(request));
}
