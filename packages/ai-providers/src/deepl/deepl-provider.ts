import { guardProviderCall } from "../guard.js";
import { checkBatchIntegrity } from "../integrity.js";
import { type TranslateRequest, type TranslationProvider, validateRequest } from "../provider.js";
import { createDefaultClient } from "./client.js";
import { type DeepLConfig, deepLConfigSchema } from "./config.js";
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
  readonly client?: DeepLTranslateClient;
  readonly freeAccount?: boolean;
}

/**
 * Create the DeepL provider. It is a machine-translation (non-LLM) provider: it implements
 * translateBatch DIRECTLY against TranslationProvider and does NOT use the shared LLM layer
 * (no LlmMechanism, no system/instruction channel, no schema). It reuses only the non-LLM
 * cross-cutting pieces: the mandatory-extractor gate, the integrity check, ProviderError,
 * and the env key reader.
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
  const genericGlossarySupplied =
    request.glossary !== undefined && Object.keys(request.glossary).length > 0;
  const { options, notices } = buildTranslateOptions({
    freeAccount: bundle.freeAccount,
    genericGlossarySupplied,
    ...(data.tone !== undefined ? { tone: data.tone } : {}),
    ...(config.glossaryId !== undefined ? { glossaryId: config.glossaryId } : {}),
  });
  const texts = data.entries.map((entry) => entry.value);
  const results = await callClient(
    bundle.client,
    texts,
    data.sourceLocale,
    data.targetLocale,
    options,
  );
  const { values, integrityInputs } = zipResults(data.entries, results);
  const integrity = checkBatchIntegrity(integrityInputs, request.extractPlaceholders);
  // Notices ride a SUCCESSFUL result only. Any throw above (mandatory-extractor gate,
  // SDK/network error, or length mismatch) discards the computed notices with the throw;
  // they are never attached to or stuffed into the thrown (secret-free) error.
  return { values, integrity, notices };
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
