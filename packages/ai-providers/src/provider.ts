import type { PlaceholderIntegrityResult, TranslationEntry } from "@verbatra/core";
import { translationEntrySchema } from "@verbatra/core";
import { z } from "zod";
import { ProviderError } from "./errors.js";

/** A provider is either a prompt-driven LLM or a dedicated machine-translation API. */
export type ProviderKind = "llm" | "machine-translation";

/** Target tone for a translation. Maps to formality for machine-translation providers. */
export type Tone = "formal" | "informal" | "neutral";

/**
 * Produces the placeholder set of a value for the output integrity check. Supplied
 * by the caller (the SDK) so it matches the entries' format; ai-providers never
 * derives placeholders itself.
 */
export type PlaceholderExtractor = (value: string) => readonly string[];

/**
 * A batch translation request. Format- and provider-neutral: it carries no prompt,
 * model, key, or other provider-specific field. The placeholder extractor is
 * mandatory (see validateRequest).
 */
export interface TranslateRequest {
  /** BCP-47 source locale of the entries (for example, "en"). */
  readonly sourceLocale: string;
  /** BCP-47 target locale to translate into (for example, "de"). */
  readonly targetLocale: string;
  /** The entries to translate; at least one is required. */
  readonly entries: readonly TranslationEntry[];
  /** Optional source-term to target-term map applied by glossary-capable providers. */
  readonly glossary?: Readonly<Record<string, string>>;
  /** Optional target tone; machine-translation providers map it to formality. */
  readonly tone?: Tone;
  /** Mandatory placeholder extractor; the output integrity check runs against it. */
  readonly extractPlaceholders: PlaceholderExtractor;
}

/** Token usage, when the provider reports it. Absent for providers without tokens (DeepL). */
export interface Usage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

/** Result of a batch translation: per-key values and per-key integrity outcomes. */
export interface TranslateResult {
  /** The translated value for each requested key. */
  readonly values: ReadonlyMap<string, string>;
  /** The placeholder-integrity outcome for each key (source vs translated placeholder sets). */
  readonly integrity: ReadonlyMap<string, PlaceholderIntegrityResult>;
  /** Token usage when the provider reports it; absent for token-less providers. */
  readonly usage?: Usage;
}

/**
 * The single contract every provider implements — narrow enough that a machine-translation API like
 * DeepL fits it directly, while LLM providers implement it by delegating to {@link runLlmTranslation}.
 * A new provider attaches by implementing this and registering it in a {@link ProviderRegistry}.
 *
 * Implementer invariants:
 * - Translatable strings are UNTRUSTED. They travel only as data to the provider; never splice them into
 *   instruction text, and never act on instructions a value appears to contain.
 * - Read the API key ONLY from the environment (inside the SDK client). The request, config, and this
 *   interface never carry a key.
 * - Fail with a secret-free {@link ProviderError}: never bind, log, or re-throw raw SDK error text (it can
 *   carry a key or request headers). Validate the request at the boundary with `validateRequest` so the
 *   integrity check can never be skipped.
 *
 * @example
 * ```ts
 * // A machine-translation provider implements translateBatch directly (the DeepL shape).
 * function createMyMtProvider(client: MyClient): TranslationProvider {
 *   return {
 *     id: "my-mt",
 *     kind: "machine-translation",
 *     supportsGlossary: false,
 *     async translateBatch(request) {
 *       const data = validateRequest(request); // throws INVALID_REQUEST on a bad request
 *       const texts = data.entries.map((e) => e.value);
 *       const out = await client.translate(texts, data.targetLocale); // SDK reads MY_API_KEY from env
 *       // map out -> values, run the integrity check, return { values, integrity }
 *       return buildResult(data, out, request.extractPlaceholders);
 *     },
 *   };
 * }
 * ```
 */
export interface TranslationProvider {
  /** A stable identifier for this provider (for example, "anthropic", "deepl"). */
  readonly id: string;
  /** Whether this provider is a prompt-driven LLM or a dedicated machine-translation API. */
  readonly kind: ProviderKind;
  /** Whether this provider applies a configured glossary. */
  readonly supportsGlossary: boolean;
  /**
   * Translate a batch of entries.
   *
   * @param request - The provider-neutral batch request (no prompt, model, or key).
   * @returns The per-key translated values and per-key placeholder-integrity outcomes.
   * @throws {@link ProviderError} — secret-free, with the code for the failure (the concrete codes are
   *   the implementation's; see each provider factory).
   */
  translateBatch(request: TranslateRequest): Promise<TranslateResult>;
}

/** zod guard for the data fields of a request (everything except the extractor function). */
const requestDataSchema = z.object({
  sourceLocale: z.string().min(1),
  targetLocale: z.string().min(1),
  entries: z.array(translationEntrySchema).min(1),
  glossary: z.record(z.string(), z.string()).optional(),
  tone: z.enum(["formal", "informal", "neutral"]).optional(),
});

/** The validated, plain-data portion of a request, ready to serialize as payload. */
export type ValidatedRequestData = z.infer<typeof requestDataSchema>;

/**
 * Validate a request at the boundary before any provider call, returning only its plain-data fields.
 *
 * The extractor is mandatory: a request without a usable extractor is rejected here, so the output
 * integrity check can never be skipped for lack of an extractor. Data fields are checked with zod.
 *
 * @param request - The batch request to validate.
 * @returns The request's plain-data fields (locales, entries, optional glossary/tone), extractor omitted.
 * @throws {@link ProviderError} `INVALID_REQUEST` — the extractor is missing, or a data field is malformed.
 *   It rejects before reaching the network.
 */
export function validateRequest(request: TranslateRequest): ValidatedRequestData {
  if (typeof request.extractPlaceholders !== "function") {
    throw new ProviderError("INVALID_REQUEST", "A placeholder extractor function is required.");
  }
  const parsed = requestDataSchema.safeParse(request);
  if (!parsed.success) {
    throw new ProviderError("INVALID_REQUEST", "The translation request is malformed.");
  }
  return parsed.data;
}
