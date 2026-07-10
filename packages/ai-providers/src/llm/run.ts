import { checkBatchIntegrity } from "../integrity.js";
import {
  type TranslateRequest,
  type TranslateResult,
  type Usage,
  validateRequest,
} from "../provider.js";
import { toIntegrityInputs } from "./integrity-inputs.js";
import { buildDataPayload } from "./payload.js";
import { reconcileResult } from "./response.js";

/** Schema-bound output plus optional usage returned by a provider mechanism. */
export interface LlmCompletion {
  /** The model's structured per-key output, as unparsed data; the shared layer validates it. */
  readonly raw: unknown;
  /** Token usage, when the SDK reports it. */
  readonly usage?: Usage;
}

/** Input handed to a mechanism: the structured data channel and the requested keys. */
export interface LlmCompletionInput {
  /** The serialized data channel (locales, entries, glossary, tone), the untrusted user-turn payload. */
  readonly payloadJson: string;
  /** The keys the model must return, in request order; the mechanism constrains output to exactly these. */
  readonly requestedKeys: readonly string[];
  /** The request's cancellation signal, if any; the mechanism threads it into its SDK call. */
  readonly signal?: AbortSignal;
}

/**
 * The single provider-supplied extension point for an LLM provider: the per-provider body that wraps one
 * SDK. Given the shared data payload, a mechanism builds its SDK request, calls it, and returns
 * schema-bound per-key translations as raw data (validated by the shared layer), never free text. It
 * surfaces refusals and SDK errors as secret-free {@link ProviderError}s.
 *
 * Implementer invariants:
 * - The system rules are compile-time constants; `input.payloadJson` is untrusted and travels only as
 *   user-turn data, never spliced into the instruction channel.
 * - Constrain the SDK via {@link deriveJsonSchema} over `translationsResultSchema` so the model constraint
 *   and the shared validation cannot drift.
 * - Read the key only from the environment, and wrap the SDK call with the guard so a raw SDK throw becomes
 *   a secret-free `PROVIDER_ERROR` and never leaks a key or headers.
 *
 * @example
 * ```ts
 * function createMyLlmMechanism(client: MySdk): LlmMechanism {
 *   return {
 *     async translate({ payloadJson, requestedKeys }) {
 *       const response = await guardProviderCall(() =>
 *         client.complete({
 *           system: SYSTEM_RULES, // compile-time constant instruction channel
 *           user: payloadJson, // untrusted data channel only
 *           responseSchema: deriveJsonSchema(translationsResultSchema), // single source of truth
 *         }),
 *       );
 *       return { raw: extractJson(response, requestedKeys), usage: toUsage(response) };
 *     },
 *   };
 * }
 * ```
 */
export interface LlmMechanism {
  /**
   * Build the SDK request from the data channel, call the SDK, and return schema-bound raw output.
   *
   * @param input - The serialized data payload and the keys the model must return.
   * @returns The model's raw per-key output (validated downstream) plus optional usage.
   * @throws {@link ProviderError} (secret-free): `PROVIDER_ERROR` for an unbound SDK throw (via the guard),
   *   and the provider's own code for a refusal, block, or truncation (`PROVIDER_REFUSED` on OpenAI,
   *   `PROVIDER_BLOCKED` on Gemini, `OUTPUT_TRUNCATED` on an output-token truncation, `INVALID_RESPONSE`
   *   for unparseable output).
   */
  translate(input: LlmCompletionInput): Promise<LlmCompletion>;
}

/**
 * The provider-agnostic LLM flow every LLM provider runs. It validates the request (the mandatory-extractor
 * gate fires here, before any mechanism call), builds the structured data channel, delegates schema-bound
 * output to the mechanism, then reconciles and runs placeholder-integrity checks on our side. An LLM
 * provider's `translateBatch` is a one-line delegation to this; only the {@link LlmMechanism} differs.
 *
 * @param request - The provider-neutral batch request.
 * @param mechanism - The per-provider SDK body (see {@link LlmMechanism}).
 * @returns The per-key translated values and per-key placeholder-integrity outcomes.
 * @throws {@link ProviderError}: `INVALID_REQUEST` if the request fails validation (missing extractor or
 *   malformed data); `INVALID_RESPONSE` if the mechanism's output is malformed, incomplete, or has an
 *   extra, duplicate, or missing key; plus any `ProviderError` the mechanism itself raises.
 * @example
 * ```ts
 * function createMyLlmProvider(client: MySdk): TranslationProvider {
 *   const mechanism = createMyLlmMechanism(client);
 *   return {
 *     id: "my-llm",
 *     kind: "llm",
 *     supportsGlossary: true,
 *     translateBatch: (request) => runLlmTranslation(request, mechanism),
 *   };
 * }
 * ```
 */
export async function runLlmTranslation(
  request: TranslateRequest,
  mechanism: LlmMechanism,
): Promise<TranslateResult> {
  const data = validateRequest(request);
  const payloadJson = JSON.stringify(buildDataPayload(data));
  const requestedKeys = data.entries.map((entry) => entry.key);
  const completion = await mechanism.translate({
    payloadJson,
    requestedKeys,
    ...(request.signal !== undefined ? { signal: request.signal } : {}),
  });
  const values = reconcileResult(completion.raw, requestedKeys);
  const integrity = checkBatchIntegrity(
    toIntegrityInputs(data.entries, values),
    request.extractPlaceholders,
    request.comparePlaceholders,
  );
  // Every LLM provider delegates translateBatch to this function, so populating notices here (an
  // always-present empty array; LLM providers never have a degradation to report) covers all four.
  return completion.usage === undefined
    ? { values, integrity, notices: [] }
    : { values, integrity, usage: completion.usage, notices: [] };
}
