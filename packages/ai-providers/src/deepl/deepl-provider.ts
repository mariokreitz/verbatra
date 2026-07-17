import type { PlaceholderIntegrityResult, TranslationEntry } from "@verbatra/core";
import { guardProviderCall } from "../guard.js";
import { checkBatchIntegrity } from "../integrity.js";
import {
  type PlaceholderComparator,
  type PlaceholderExtractor,
  type ReviewFlag,
  type TranslateRequest,
  type TranslationProvider,
  type ValidatedRequestData,
  validateRequest,
} from "../provider.js";
import { applyProviderDegraded, computeReviewFlags } from "../review-flags.js";
import { createDefaultClient } from "./client.js";
import { type DeepLConfig, deepLConfigSchema } from "./config.js";
import { chunkTextsForDeepL } from "./limits.js";
import { assertValidDeepLSourceLocale, assertValidDeepLTargetLocale } from "./locale-validation.js";
import { PLACEHOLDER_UNSUPPORTED_MESSAGE, partitionByPlaceholders } from "./placeholders.js";
import { buildTranslateOptions } from "./request.js";
import { zipResults } from "./response.js";
import type {
  DeepLClientBundle,
  DeepLTextResult,
  DeepLTranslateClient,
  DeepLTranslateOptions,
  DeepLTranslateResult,
} from "./types.js";

const PROVIDER_ID = "deepl";

/**
 * Optional dependencies, used by tests to inject a stub client (keeps tests offline).
 * `freeAccount` lets a test exercise the free-key (":fx") degradation path without a key.
 */
export interface DeepLDeps {
  /** A stub client; when omitted, the production client is built and reads the env key. */
  readonly client?: DeepLTranslateClient;
  /** Forces the free-tier degradation path in tests; in production it is derived from the key suffix. */
  readonly freeAccount?: boolean;
}

/**
 * Create the DeepL provider, a machine-translation (non-LLM) provider that implements
 * translateBatch directly against TranslationProvider.
 *
 * `supportsGlossary` is an honest capability signal: it is true only when a native glossary id is
 * configured, because DeepL only ever applies a pre-created glossary id, never a generic term map
 * (see `buildTranslateOptions`). Without one configured, a supplied term map is silently ignored and
 * surfaces only as a `GLOSSARY_IGNORED` notice.
 *
 * @param config - An optional pre-existing DeepL glossary id; never a key.
 * @param deps - Optional injected client and free-tier flag; when omitted, the production client is built.
 * @returns A {@link TranslationProvider} whose result also carries {@link ProviderNotice}s
 *   (`FORMALITY_DOWNGRADED`, `GLOSSARY_IGNORED`, `PLACEHOLDER_UNSUPPORTED`) as data. Its `translateBatch` raises
 *   {@link ProviderError} `INVALID_REQUEST`, `INVALID_RESPONSE` (a result-count mismatch), or (via the
 *   shared guard) `RATE_LIMITED`, `TIMEOUT`, `AUTH_FAILED`, or `PROVIDER_ERROR`, never
 *   `PROVIDER_REFUSED` or `PROVIDER_BLOCKED`.
 * @throws A `ZodError` if `config` is invalid.
 * @throws {@link ProviderError} `MISSING_API_KEY`: at construction, when no client is injected and
 *   `DEEPL_API_KEY` is unset (the default client reads the env key eagerly).
 * @example
 * ```ts
 * // The key is read from DEEPL_API_KEY in the environment; it is never passed here.
 * const provider = createDeepLProvider({});
 * // translateBatch is typed to TranslateResult; the concrete DeepL result also carries notices.
 * const result = (await provider.translateBatch(request)) as DeepLTranslateResult;
 * for (const notice of result.notices) {
 *   // notice.code is FORMALITY_DOWNGRADED, GLOSSARY_IGNORED, or PLACEHOLDER_UNSUPPORTED. These are data, not errors.
 * }
 * ```
 */
export function createDeepLProvider(
  config: DeepLConfig,
  deps: DeepLDeps = {},
): TranslationProvider {
  const validConfig = deepLConfigSchema.parse(config);
  const bundle = resolveClient(deps);
  return {
    id: PROVIDER_ID,
    kind: "machine-translation",
    supportsGlossary: validConfig.glossaryId !== undefined,
    translateBatch: (request: TranslateRequest): Promise<DeepLTranslateResult> =>
      translate(bundle, validConfig, request),
  };
}

function resolveClient(deps: DeepLDeps): DeepLClientBundle {
  if (deps.client !== undefined) {
    return { client: deps.client, freeAccount: deps.freeAccount ?? false };
  }
  return createDefaultClient();
}

/**
 * The DeepL translateBatch body. Placeholder- and ICU-bearing entries are withheld (absent from both
 * result maps) rather than sent to DeepL, which would mangle their tokens; withholding surfaces as a
 * `PLACEHOLDER_UNSUPPORTED` notice. Notices ride a successful result only: any throw discards them,
 * so they never attach to an error.
 */
async function translate(
  bundle: DeepLClientBundle,
  config: DeepLConfig,
  request: TranslateRequest,
): Promise<DeepLTranslateResult> {
  const data = validateRequest(request);
  assertValidDeepLSourceLocale(data.sourceLocale);
  assertValidDeepLTargetLocale(data.targetLocale);
  const { protectable, unprotectable } = partitionByPlaceholders(data.entries);
  const genericGlossarySupplied =
    request.glossary !== undefined && Object.keys(request.glossary).length > 0;
  const { options, notices } = buildTranslateOptions({
    freeAccount: bundle.freeAccount,
    genericGlossarySupplied,
    ...(data.tone !== undefined ? { tone: data.tone } : {}),
    ...(config.glossaryId !== undefined ? { glossaryId: config.glossaryId } : {}),
  });
  const { values, integrity } = await translateProtectable(
    bundle.client,
    data,
    protectable,
    options,
    request.extractPlaceholders,
    request.comparePlaceholders,
    request.signal,
  );
  if (unprotectable.length > 0) {
    notices.push({ code: "PLACEHOLDER_UNSUPPORTED", message: PLACEHOLDER_UNSUPPORTED_MESSAGE });
  }
  const reviewFlags = applyProviderDegraded(
    buildReviewFlags(protectable, data, values, integrity, request.glossary),
    notices,
    [...values.keys()],
  );
  return { values, integrity, notices, reviewFlags };
}

/** Compute a {@link ReviewFlag} for every translated (protectable) entry. */
function buildReviewFlags(
  protectable: readonly TranslationEntry[],
  data: ValidatedRequestData,
  values: ReadonlyMap<string, string>,
  integrity: ReadonlyMap<string, PlaceholderIntegrityResult>,
  glossary: Readonly<Record<string, string>> | undefined,
): Map<string, ReviewFlag> {
  const reviewFlags = new Map<string, ReviewFlag>();
  for (const entry of protectable) {
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
      glossary,
    });
    if (flag !== undefined) {
      reviewFlags.set(entry.key, flag);
    }
  }
  return reviewFlags;
}

/**
 * Translate only the placeholder-free entries. DeepL is never called with an empty array: when there
 * is nothing protectable to send, both result maps are empty and no request is made.
 */
async function translateProtectable(
  client: DeepLTranslateClient,
  data: ValidatedRequestData,
  protectable: readonly TranslationEntry[],
  options: DeepLTranslateOptions,
  extract: PlaceholderExtractor,
  compare: PlaceholderComparator | undefined,
  signal: AbortSignal | undefined,
): Promise<{
  values: Map<string, string>;
  integrity: Map<string, PlaceholderIntegrityResult>;
}> {
  if (protectable.length === 0) {
    return { values: new Map(), integrity: new Map() };
  }
  const texts = protectable.map((entry) => entry.value);
  const results = await callClientChunked(
    client,
    texts,
    data.sourceLocale,
    data.targetLocale,
    options,
    signal,
  );
  const { values, integrityInputs } = zipResults(protectable, results);
  const integrity = checkBatchIntegrity(integrityInputs, extract, compare);
  return { values, integrity };
}

/**
 * Call DeepL through the shared guard so a raw SDK/axios error (auth header) never leaks.
 *
 * deepl-node's `translateText` accepts no cancellation signal, so `signal` cannot be threaded into
 * the network call itself; passing it to the guard still gives a caller-initiated abort a preflight
 * check (an already-aborted signal rejects before any request is sent) and correct abort-vs-failure
 * classification, but an abort cannot interrupt a DeepL call already in flight.
 */
function callClient(
  client: DeepLTranslateClient,
  texts: readonly string[],
  sourceLang: string,
  targetLang: string,
  options: DeepLTranslateOptions,
  signal: AbortSignal | undefined,
): Promise<DeepLTextResult[]> {
  return guardProviderCall(
    () => client.translateText(texts, sourceLang, targetLang, options),
    signal,
  );
}

/**
 * Call DeepL in as many sequential requests as needed to stay within DeepL's per-request caps
 * (see {@link chunkTextsForDeepL}), independent of and in addition to the SDK's own
 * `maxBatchSize`-driven sub-batching upstream. A sub-batch that already fits in one request produces
 * exactly one chunk, so behavior is unchanged for the common in-cap case. Chunks are sent in order and
 * their results concatenated in the same order, so the flat result array still lines up positionally
 * with `texts` for {@link zipResults}.
 */
async function callClientChunked(
  client: DeepLTranslateClient,
  texts: readonly string[],
  sourceLang: string,
  targetLang: string,
  options: DeepLTranslateOptions,
  signal: AbortSignal | undefined,
): Promise<DeepLTextResult[]> {
  const results: DeepLTextResult[] = [];
  for (const chunk of chunkTextsForDeepL(texts)) {
    const chunkResults = await callClient(client, chunk, sourceLang, targetLang, options, signal);
    results.push(...chunkResults);
  }
  return results;
}
