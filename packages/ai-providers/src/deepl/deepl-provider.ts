import type { PlaceholderIntegrityResult, TranslationEntry } from "@verbatra/core";
import { guardProviderCall } from "../guard.js";
import { checkBatchIntegrity } from "../integrity.js";
import {
  type PlaceholderExtractor,
  type TranslateRequest,
  type TranslationProvider,
  type ValidatedRequestData,
  validateRequest,
} from "../provider.js";
import { createDefaultClient } from "./client.js";
import { type DeepLConfig, deepLConfigSchema } from "./config.js";
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
 * @param config - An optional pre-existing DeepL glossary id; never a key.
 * @param deps - Optional injected client and free-tier flag; when omitted, the production client is built.
 * @returns A {@link TranslationProvider} whose result also carries {@link ProviderNotice}s
 *   (`FORMALITY_DOWNGRADED`, `GLOSSARY_IGNORED`, `PLACEHOLDER_UNSUPPORTED`) as data. Its `translateBatch` raises
 *   {@link ProviderError} `INVALID_REQUEST`, `INVALID_RESPONSE` (a result-count mismatch), or
 *   `PROVIDER_ERROR`, never `PROVIDER_REFUSED` or `PROVIDER_BLOCKED`.
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
    supportsGlossary: true,
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

async function translate(
  bundle: DeepLClientBundle,
  config: DeepLConfig,
  request: TranslateRequest,
): Promise<DeepLTranslateResult> {
  const data = validateRequest(request);
  const { protectable, unprotectable } = partitionByPlaceholders(data.entries);
  const genericGlossarySupplied =
    request.glossary !== undefined && Object.keys(request.glossary).length > 0;
  const { options, notices } = buildTranslateOptions({
    freeAccount: bundle.freeAccount,
    genericGlossarySupplied,
    ...(data.tone !== undefined ? { tone: data.tone } : {}),
    ...(config.glossaryId !== undefined ? { glossaryId: config.glossaryId } : {}),
  });
  // Placeholder- and ICU-bearing entries are withheld (absent from both maps) rather than sent to
  // DeepL, which would mangle their tokens and loop forever on a never-converging paid retry.
  const { values, integrity } = await translateProtectable(
    bundle.client,
    data,
    protectable,
    options,
    request.extractPlaceholders,
  );
  if (unprotectable.length > 0) {
    notices.push({ code: "PLACEHOLDER_UNSUPPORTED", message: PLACEHOLDER_UNSUPPORTED_MESSAGE });
  }
  // Notices ride a successful result only; any throw above discards them so they never attach to the error.
  return { values, integrity, notices };
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
): Promise<{
  values: Map<string, string>;
  integrity: Map<string, PlaceholderIntegrityResult>;
}> {
  if (protectable.length === 0) {
    return { values: new Map(), integrity: new Map() };
  }
  const texts = protectable.map((entry) => entry.value);
  const results = await callClient(client, texts, data.sourceLocale, data.targetLocale, options);
  const { values, integrityInputs } = zipResults(protectable, results);
  const integrity = checkBatchIntegrity(integrityInputs, extract);
  return { values, integrity };
}

/** Call DeepL through the shared guard so a raw SDK/axios error (auth header) never leaks. */
function callClient(
  client: DeepLTranslateClient,
  texts: readonly string[],
  sourceLang: string,
  targetLang: string,
  options: DeepLTranslateOptions,
): Promise<DeepLTextResult[]> {
  return guardProviderCall(() => client.translateText(texts, sourceLang, targetLang, options));
}
