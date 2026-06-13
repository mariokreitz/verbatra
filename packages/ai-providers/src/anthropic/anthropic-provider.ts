import type { TranslationEntry } from "@verbatra/core";
import { ProviderError } from "../errors.js";
import { checkBatchIntegrity, type IntegrityInput } from "../integrity.js";
import {
  type TranslateRequest,
  type TranslateResult,
  type TranslationProvider,
  type Usage,
  validateRequest,
} from "../provider.js";
import { createDefaultClient } from "./client.js";
import { type AnthropicConfig, anthropicConfigSchema } from "./config.js";
import { type BuiltRequest, buildRequest } from "./request.js";
import { parseTranslations } from "./response.js";
import type { AnthropicMessage, MessagesClient } from "./types.js";

const PROVIDER_ID = "anthropic";

/** Optional dependencies, used by tests to inject a stub client (keeps tests offline). */
export interface AnthropicDeps {
  readonly client?: MessagesClient;
}

/**
 * Create the Anthropic LLM provider. The model and max-tokens come from config; the
 * API key is read only from the environment (via the default client). A stub client
 * may be injected for testing. The returned provider satisfies TranslationProvider.
 */
export function createAnthropicProvider(
  config: AnthropicConfig,
  deps: AnthropicDeps = {},
): TranslationProvider {
  const validConfig = anthropicConfigSchema.parse(config);
  const client = deps.client ?? createDefaultClient();
  return {
    id: PROVIDER_ID,
    kind: "llm",
    supportsGlossary: true,
    translateBatch: (request) => translate(client, validConfig, request),
  };
}

async function translate(
  client: MessagesClient,
  config: AnthropicConfig,
  request: TranslateRequest,
): Promise<TranslateResult> {
  const data = validateRequest(request);
  const body = buildRequest(config, data);
  const message = await callClient(client, body);
  const values = parseTranslations(
    message.content,
    data.entries.map((entry) => entry.key),
  );
  const integrity = checkBatchIntegrity(
    toIntegrityInputs(data.entries, values),
    request.extractPlaceholders,
  );
  const usage = toUsage(message.usage);
  return usage === undefined ? { values, integrity } : { values, integrity, usage };
}

/** Call the provider, never re-throwing the raw SDK error (it can carry secrets). */
async function callClient(client: MessagesClient, body: BuiltRequest): Promise<AnthropicMessage> {
  try {
    return await client.messages.create(body);
  } catch {
    throw new ProviderError("PROVIDER_ERROR", "The translation provider request failed.");
  }
}

/** Pair each source entry with its translated value for the integrity check. */
export function toIntegrityInputs(
  entries: readonly TranslationEntry[],
  values: ReadonlyMap<string, string>,
): IntegrityInput[] {
  return entries.map((entry) => {
    const translatedValue = values.get(entry.key);
    if (translatedValue === undefined) {
      throw new ProviderError(
        "INVALID_RESPONSE",
        "The provider response is missing one or more keys.",
      );
    }
    return { key: entry.key, sourcePlaceholders: entry.placeholders, translatedValue };
  });
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
