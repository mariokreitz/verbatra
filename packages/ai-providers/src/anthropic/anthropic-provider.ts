import { guardProviderCall } from "../guard.js";
import { type LlmCompletion, type LlmMechanism, runLlmTranslation } from "../llm/run.js";
import type { TranslateRequest, TranslateResult, TranslationProvider, Usage } from "../provider.js";
import { createDefaultClient } from "./client.js";
import { type AnthropicConfig, anthropicConfigSchema } from "./config.js";
import { type BuiltRequest, buildRequest } from "./request.js";
import { requireToolInput } from "./response.js";
import type { AnthropicMessage, MessagesClient } from "./types.js";

// Re-exported so existing imports of this path keep resolving after the extraction.
export { toIntegrityInputs } from "../llm/integrity-inputs.js";

const PROVIDER_ID = "anthropic";

/** Optional dependencies, used by tests to inject a stub client (keeps tests offline). */
export interface AnthropicDeps {
  /** A stub messages client; when omitted, the production client is built and reads the env key. */
  readonly client?: MessagesClient;
}

/**
 * Create the Anthropic LLM provider. Forced tool-use is its mechanism behind the
 * shared layer's extension point; the model and max-tokens come from config and the
 * API key is read only from the environment (via the default client).
 *
 * @param config - The model and max-tokens; never a key.
 * @param deps - Optional injected client; when omitted, the production client is built.
 * @returns A {@link TranslationProvider}. Its `translateBatch` raises {@link ProviderError}
 *   `INVALID_REQUEST`, `INVALID_RESPONSE`, or `PROVIDER_ERROR`, never `PROVIDER_REFUSED` or
 *   `PROVIDER_BLOCKED`.
 * @throws A `ZodError` if `config` is invalid.
 * @throws {@link ProviderError} `MISSING_API_KEY`: at construction, when no client is injected and
 *   `ANTHROPIC_API_KEY` is unset (the default client reads the env key eagerly).
 * @example
 * ```ts
 * // The key is read from ANTHROPIC_API_KEY in the environment; it is never passed here.
 * const provider = createAnthropicProvider({ model: "claude-sonnet-4-5", maxTokens: 1024 });
 * const result = await provider.translateBatch(request);
 * ```
 */
export function createAnthropicProvider(
  config: AnthropicConfig,
  deps: AnthropicDeps = {},
): TranslationProvider {
  const validConfig = anthropicConfigSchema.parse(config);
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

/** Anthropic's mechanism: build the forced-tool-use request, call it, return raw tool input. */
function createMechanism(client: MessagesClient, config: AnthropicConfig): LlmMechanism {
  return {
    translate: async ({ payloadJson }): Promise<LlmCompletion> => {
      const body = buildRequest(config, payloadJson);
      const message = await callClient(client, body);
      const raw = requireToolInput(message.content);
      const usage = toUsage(message.usage);
      return usage === undefined ? { raw } : { raw, usage };
    },
  };
}

/** Call the provider through the shared guard so a raw SDK error never leaks. */
function callClient(client: MessagesClient, body: BuiltRequest): Promise<AnthropicMessage> {
  return guardProviderCall(() => client.messages.create(body));
}

/** Map Anthropic usage to our Usage shape, or undefined when not fully reported. */
export function toUsage(usage: AnthropicMessage["usage"]): Usage | undefined {
  if (usage === undefined) {
    return undefined;
  }
  const { input_tokens, output_tokens } = usage;
  if (typeof input_tokens !== "number" || typeof output_tokens !== "number") {
    return undefined;
  }
  return { inputTokens: input_tokens, outputTokens: output_tokens };
}
