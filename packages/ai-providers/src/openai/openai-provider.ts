import { type LlmMechanism, runLlmTranslation } from "../llm/run.js";
import type { TranslateRequest, TranslateResult, TranslationProvider } from "../provider.js";
import { DEFAULT_REQUEST_TIMEOUT_MS, withRequestTimeout } from "../request-timeout.js";
import { createDefaultClient } from "./client.js";
import { type OpenAiConfig, openAiConfigSchema } from "./config.js";
import { buildOpenAiRequest, type OpenAiRequest } from "./request.js";
import { extractOpenAiResult } from "./response.js";
import type { OpenAiClient, OpenAiCompletion } from "./types.js";

const PROVIDER_ID = "openai";

/** Optional dependencies, used by tests to inject a stub client (keeps tests offline). */
export interface OpenAiDeps {
  /** A stub client; when omitted, the production client is built and reads the env key. */
  readonly client?: OpenAiClient;
}

/**
 * Create the OpenAI LLM provider. The model and output-token limit come from config;
 * the API key is read only from the environment via the default client.
 *
 * @param config - The model and output-token limit; never a key.
 * @param deps - Optional injected client; when omitted, the production client is built.
 * @returns A {@link TranslationProvider}. Its `translateBatch` raises {@link ProviderError}
 *   `INVALID_REQUEST`, `INVALID_RESPONSE`, `OUTPUT_TRUNCATED`, `PROVIDER_REFUSED` (the model's refusal
 *   path), or (via the shared guard) `RATE_LIMITED`, `TIMEOUT`, `AUTH_FAILED`, or `PROVIDER_ERROR`,
 *   never `PROVIDER_BLOCKED`.
 * @throws A `ZodError` if `config` is invalid.
 * @throws {@link ProviderError} `MISSING_API_KEY`: at construction, when no client is injected and
 *   `OPENAI_API_KEY` is unset (the default client reads the env key eagerly).
 * @example
 * ```ts
 * // The key is read from OPENAI_API_KEY in the environment; it is never passed here.
 * const provider = createOpenAiProvider({ model: "gpt-4o", maxOutputTokens: 1024 });
 * const result = await provider.translateBatch(request);
 * ```
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

function createMechanism(client: OpenAiClient, config: OpenAiConfig): LlmMechanism {
  const timeoutMs = config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  return {
    translate: async ({ payloadJson, signal }): Promise<ReturnType<typeof extractOpenAiResult>> => {
      const body = buildOpenAiRequest(config, payloadJson);
      const completion = await callClient(client, body, timeoutMs, signal);
      return extractOpenAiResult(completion);
    },
  };
}

/**
 * Call the provider through {@link withRequestTimeout} so the request is bounded by the configured
 * timeout, a raw SDK error never leaks, and the composed (caller plus timeout) signal is threaded
 * into the SDK call so a timeout really cancels it.
 */
function callClient(
  client: OpenAiClient,
  body: OpenAiRequest,
  timeoutMs: number,
  signal: AbortSignal | undefined,
): Promise<OpenAiCompletion> {
  return withRequestTimeout(timeoutMs, signal, (requestSignal) =>
    client.chat.completions.create(body, { signal: requestSignal }),
  );
}
