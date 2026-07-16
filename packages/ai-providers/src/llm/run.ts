import type { PlaceholderIntegrityResult, TranslationEntry } from "@verbatra/core";
import { checkBatchIntegrity } from "../integrity.js";
import {
  type ProviderNotice,
  type ReviewFlag,
  type TranslateRequest,
  type TranslateResult,
  type Usage,
  type ValidatedRequestData,
  validateRequest,
} from "../provider.js";
import { applyProviderDegraded, computeReviewFlags } from "../review-flags.js";
import { toIntegrityInputs } from "./integrity-inputs.js";
import { buildDataPayload } from "./payload.js";
import { type ReconcileOutcome, reconcileResult } from "./response.js";

/**
 * Hard cap on reconcile repair rounds. When the first response leaves keys missing or duplicated (but
 * no hallucinated key, which fails immediately), exactly one bounded re-request is issued for the
 * still-missing subset. Keys still unresolved after this cap are left out of the result entirely,
 * distinct from a placeholder-integrity mismatch: nothing was translated for them.
 */
const MAX_REPAIR_ROUNDS = 1;

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
 * Because every LLM provider delegates here, the result's `notices` is populated for all of them: an
 * always-present empty array, since LLM providers have no graceful degradation to report.
 *
 * @param request - The provider-neutral batch request.
 * @param mechanism - The per-provider SDK body (see {@link LlmMechanism}).
 * @returns The translated values and placeholder-integrity outcomes for every key accepted this run.
 *   A key missing or duplicated in the first response is retried once, bounded by
 *   {@link MAX_REPAIR_ROUNDS}; a key still unresolved after that cap is left out of both maps entirely
 *   (the caller distinguishes this from an integrity mismatch, since nothing was translated for it).
 * @throws {@link ProviderError}: `INVALID_REQUEST` if the request fails validation (missing extractor or
 *   malformed data); `INVALID_RESPONSE` if a mechanism response is malformed or contains a hallucinated
 *   (unrequested) key, in the first response or the repair round; plus any `ProviderError` the mechanism
 *   itself raises.
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
  const signal = request.signal;

  const first = await requestTranslations(mechanism, data, signal);
  const values = first.outcome.accepted;
  let usage = first.completion.usage;

  let toRepair = entriesFor(data.entries, first.outcome.missingKeys);
  for (let round = 0; round < MAX_REPAIR_ROUNDS && toRepair.length > 0; round += 1) {
    const repair = await requestTranslations(mechanism, { ...data, entries: toRepair }, signal);
    for (const [key, value] of repair.outcome.accepted) {
      values.set(key, value);
    }
    usage = mergeUsage(usage, repair.completion.usage);
    toRepair = entriesFor(data.entries, repair.outcome.missingKeys);
  }

  const integrity = checkBatchIntegrity(
    toIntegrityInputs(data.entries, values),
    request.extractPlaceholders,
    request.comparePlaceholders,
  );
  const notices: readonly ProviderNotice[] = [];
  const reviewFlags = applyProviderDegraded(buildReviewFlags(data, values, integrity), notices, [
    ...values.keys(),
  ]);
  return usage === undefined
    ? { values, integrity, notices, reviewFlags }
    : { values, integrity, usage, notices, reviewFlags };
}

/** Compute a {@link ReviewFlag} for every key with a translated value, skipping keys with none. */
function buildReviewFlags(
  data: ValidatedRequestData,
  values: ReadonlyMap<string, string>,
  integrity: ReadonlyMap<string, PlaceholderIntegrityResult>,
): Map<string, ReviewFlag> {
  const reviewFlags = new Map<string, ReviewFlag>();
  for (const entry of data.entries) {
    const translatedValue = values.get(entry.key);
    const entryIntegrity = integrity.get(entry.key);
    if (translatedValue === undefined || entryIntegrity === undefined) {
      continue;
    }
    const flag = computeReviewFlags({
      sourceValue: entry.value,
      translatedValue,
      sourceLocale: data.sourceLocale,
      targetLocale: data.targetLocale,
      integrity: entryIntegrity,
      glossary: data.glossary,
    });
    if (flag !== undefined) {
      reviewFlags.set(entry.key, flag);
    }
  }
  return reviewFlags;
}

/** Call the mechanism for the given entries and reconcile its output against them. */
async function requestTranslations(
  mechanism: LlmMechanism,
  data: ValidatedRequestData,
  signal: AbortSignal | undefined,
): Promise<{ readonly completion: LlmCompletion; readonly outcome: ReconcileOutcome }> {
  const payloadJson = JSON.stringify(buildDataPayload(data));
  const requestedKeys = data.entries.map((entry) => entry.key);
  const completion = await mechanism.translate({
    payloadJson,
    requestedKeys,
    ...(signal !== undefined ? { signal } : {}),
  });
  return { completion, outcome: reconcileResult(completion.raw, requestedKeys) };
}

/** The subset of `entries` whose key is in `keys`, preserving `entries` order. */
function entriesFor(
  entries: readonly TranslationEntry[],
  keys: readonly string[],
): TranslationEntry[] {
  const wanted = new Set(keys);
  return entries.filter((entry) => wanted.has(entry.key));
}

/** Sum token usage across rounds; falls back to whichever side reported usage when only one did. */
function mergeUsage(first: Usage | undefined, second: Usage | undefined): Usage | undefined {
  if (first === undefined) {
    return second;
  }
  if (second === undefined) {
    return first;
  }
  return {
    inputTokens: first.inputTokens + second.inputTokens,
    outputTokens: first.outputTokens + second.outputTokens,
  };
}
