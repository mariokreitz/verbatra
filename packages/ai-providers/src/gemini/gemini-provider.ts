import { type LlmCompletion, type LlmMechanism, runLlmTranslation } from "../llm/run.js";
import type { TranslateRequest, TranslateResult, TranslationProvider } from "../provider.js";
import { DEFAULT_REQUEST_TIMEOUT_MS, withRequestTimeout } from "../request-timeout.js";
import { createDefaultClient } from "./client.js";
import { type GeminiConfig, geminiConfigSchema } from "./config.js";
import { buildGeminiRequest } from "./request.js";
import { extractGeminiResult } from "./response.js";
import type { GeminiClient } from "./types.js";

const PROVIDER_ID = "gemini";

/** Optional dependencies for injecting a stub client in tests. */
export interface GeminiDeps {
  /** A stub client; when omitted, the production client is built and reads the env key. */
  readonly client?: GeminiClient;
}

/**
 * Create the Gemini LLM provider. The model and output-token limit come from config;
 * the API key is read only from the environment via the default client.
 *
 * @param config - The model and output-token limit; never a key.
 * @param deps - Optional injected client; when omitted, the production client is built.
 * @returns A {@link TranslationProvider}. Its `translateBatch` raises {@link ProviderError}
 *   `INVALID_REQUEST`, `INVALID_RESPONSE`, `OUTPUT_TRUNCATED`, `PROVIDER_BLOCKED`, or (via the
 *   shared guard) `RATE_LIMITED`, `TIMEOUT`, `AUTH_FAILED`, or `PROVIDER_ERROR`, never
 *   `PROVIDER_REFUSED`.
 * @throws A `ZodError` if `config` is invalid.
 * @throws {@link ProviderError} `MISSING_API_KEY` at construction, when no client is injected and
 *   `GEMINI_API_KEY` is unset.
 * @example
 * ```ts
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

function createMechanism(client: GeminiClient, config: GeminiConfig): LlmMechanism {
  const timeoutMs = config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  return {
    translate: async ({ payloadJson, signal }): Promise<LlmCompletion> => {
      const response = await withRequestTimeout(timeoutMs, signal, (requestSignal) =>
        client.models.generateContent(buildGeminiRequest(config, payloadJson, requestSignal)),
      );
      return extractGeminiResult(response);
    },
  };
}
