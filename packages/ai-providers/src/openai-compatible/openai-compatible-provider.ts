import { type LlmMechanism, runLlmTranslation } from "../llm/run.js";
import { buildOpenAiRequest, type OpenAiRequest } from "../openai/request.js";
import { extractOpenAiResult } from "../openai/response.js";
import type { OpenAiClient, OpenAiCompletion } from "../openai/types.js";
import type { TranslateRequest, TranslateResult, TranslationProvider } from "../provider.js";
import { DEFAULT_REQUEST_TIMEOUT_MS, withRequestTimeout } from "../request-timeout.js";
import { createDefaultClient } from "./client.js";
import {
  endpointHostOf,
  type OpenAiCompatibleConfig,
  openAiCompatibleConfigSchema,
} from "./config.js";

const PROVIDER_ID = "openai-compatible";

export interface OpenAiCompatibleDeps {
  readonly client?: OpenAiClient;
}

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
  const timeoutMs = config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const endpointHost = endpointHostOf(config.baseUrl);
  return {
    translate: async ({ payloadJson, signal }): Promise<ReturnType<typeof extractOpenAiResult>> => {
      const body = buildOpenAiRequest(config, payloadJson, "strict-schema", "max_tokens");
      const completion = await callClient(client, body, timeoutMs, signal, endpointHost);
      return extractOpenAiResult(completion, true);
    },
  };
}

function callClient(
  client: OpenAiClient,
  body: OpenAiRequest,
  timeoutMs: number,
  signal: AbortSignal | undefined,
  endpointHost: string | undefined,
): Promise<OpenAiCompletion> {
  return withRequestTimeout(
    timeoutMs,
    signal,
    (requestSignal) => client.chat.completions.create(body, { signal: requestSignal }),
    endpointHost === undefined ? undefined : { endpointHost },
  );
}
