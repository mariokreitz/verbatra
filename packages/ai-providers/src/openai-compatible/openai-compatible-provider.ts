import { guardProviderCall } from "../guard.js";
import { type LlmMechanism, runLlmTranslation } from "../llm/run.js";
import { buildOpenAiRequest, type OpenAiRequest } from "../openai/request.js";
import { extractOpenAiResult } from "../openai/response.js";
import type { OpenAiClient, OpenAiCompletion } from "../openai/types.js";
import type { TranslateRequest, TranslateResult, TranslationProvider } from "../provider.js";
import { createDefaultClient } from "./client.js";
import { type OpenAiCompatibleConfig, openAiCompatibleConfigSchema } from "./config.js";

const PROVIDER_ID = "openai-compatible";

/** Optional dependencies, used by tests to inject a stub client (keeps tests offline). */
export interface OpenAiCompatibleDeps {
  /** A stub client; when omitted, the production client is built against the configured `baseUrl`. */
  readonly client?: OpenAiClient;
}

/**
 * Create the openai-compatible LLM provider, for a local or self-hosted OpenAI-compatible inference
 * server (LM Studio, Ollama, vLLM). `baseUrl`, `model`, and the output-token limit come from config; the
 * API key is resolved by `resolveOpenAiCompatibleKey` (env.ts), never `requireOpenAiKey`, and defaults to
 * the non-secret placeholder `"local"` when no key is configured.
 *
 * The request body is built in `strict-schema` mode, the same `json_schema` shape as the hosted `openai`
 * provider (verified against a live LM Studio server, which rejects the `json_object` mode some other
 * local servers accept), but the token limit is sent as `max_tokens`, not the hosted provider's
 * `max_completion_tokens`: `max_tokens` is the field understood broadly across OpenAI-compatible servers
 * (LM Studio, Ollama, vLLM, and hosted OpenAI-compatible APIs such as Mistral's, which reject
 * `max_completion_tokens` outright). The one deliberate difference from the hosted provider is that this
 * provider parses its response tolerantly (extracting the first brace-balanced JSON object anywhere in
 * the content before `JSON.parse`, regardless of surrounding prose or Markdown fences), since a local or
 * weaker model can still wrap a schema-conforming answer in a ```json block despite the constraint.
 * Output still runs through the exact same `runLlmTranslation` flow as every other provider:
 * canonical schema validation and placeholder/ICU integrity are unconditional, so local output is
 * untrusted input like any other provider's, with no shortcut.
 *
 * @param config - `baseUrl`, `model`, `maxOutputTokens`, and an optional `apiKeyEnvVar`; never a key
 *   value.
 * @param deps - Optional injected client; when omitted, the production client is built.
 * @returns A {@link TranslationProvider}. Its `translateBatch` raises {@link ProviderError}
 *   `INVALID_REQUEST`, `INVALID_RESPONSE`, `OUTPUT_TRUNCATED`, `PROVIDER_REFUSED`, or (via the
 *   shared guard) `RATE_LIMITED`, `TIMEOUT`, `AUTH_FAILED`, or `PROVIDER_ERROR`.
 * @throws A `ZodError` if `config` is invalid, including a malformed or non-http(s) `baseUrl`, or an
 *   `apiKeyEnvVar` naming a hosted provider's environment variable.
 * @throws {@link ProviderError} `MISSING_API_KEY`: at construction, when no client is injected,
 *   `apiKeyEnvVar` is set in config, and its named variable is unset or empty.
 * @example
 * ```ts
 * // No API key needed for a keyless local server; the SDK receives the "local" placeholder.
 * // baseUrl must include the server's API path segment (LM Studio, Ollama, and vLLM all serve
 * // their OpenAI-compatible routes under /v1, the same convention the openai SDK itself expects).
 * const provider = createOpenAiCompatibleProvider({
 *   baseUrl: "http://192.168.178.74:1234/v1",
 *   model: "google/gemma-4-26b-a4b-qat",
 *   maxOutputTokens: 1024,
 * });
 * const result = await provider.translateBatch(request);
 * ```
 */
export function createOpenAiCompatibleProvider(
  config: OpenAiCompatibleConfig,
  deps: OpenAiCompatibleDeps = {},
): TranslationProvider {
  const validConfig = openAiCompatibleConfigSchema.parse(config);
  const client = deps.client ?? createDefaultClient(validConfig);
  const mechanism = createMechanism(client, validConfig);
  return {
    id: PROVIDER_ID,
    kind: "llm",
    supportsGlossary: true,
    translateBatch: (request: TranslateRequest): Promise<TranslateResult> =>
      runLlmTranslation(request, mechanism),
  };
}

function createMechanism(client: OpenAiClient, config: OpenAiCompatibleConfig): LlmMechanism {
  return {
    translate: async ({ payloadJson, signal }): Promise<ReturnType<typeof extractOpenAiResult>> => {
      const body = buildOpenAiRequest(config, payloadJson, "strict-schema", "max_tokens");
      const completion = await callClient(client, body, signal);
      return extractOpenAiResult(completion, true);
    },
  };
}

/** Call the provider through the shared guard so a raw SDK error never leaks; threads the signal
 * into both the guard's abort handling and the SDK call itself. */
function callClient(
  client: OpenAiClient,
  body: OpenAiRequest,
  signal: AbortSignal | undefined,
): Promise<OpenAiCompletion> {
  return guardProviderCall(
    () => client.chat.completions.create(body, signal !== undefined ? { signal } : undefined),
    signal,
  );
}
