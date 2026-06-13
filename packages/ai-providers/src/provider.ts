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
  readonly sourceLocale: string;
  readonly targetLocale: string;
  readonly entries: readonly TranslationEntry[];
  readonly glossary?: Readonly<Record<string, string>>;
  readonly tone?: Tone;
  readonly extractPlaceholders: PlaceholderExtractor;
}

/** Token usage, when the provider reports it. Absent for providers without tokens (DeepL). */
export interface Usage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

/** Result of a batch translation: per-key values and per-key integrity outcomes. */
export interface TranslateResult {
  readonly values: ReadonlyMap<string, string>;
  readonly integrity: ReadonlyMap<string, PlaceholderIntegrityResult>;
  readonly usage?: Usage;
}

/** The single contract every provider implements, narrow enough that DeepL fits it. */
export interface TranslationProvider {
  readonly id: string;
  readonly kind: ProviderKind;
  readonly supportsGlossary: boolean;
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
 * Validate a request at the boundary before any provider call. The extractor is
 * mandatory: a request without a usable extractor is rejected here, so the output
 * integrity check can never be skipped for lack of an extractor. Data fields are
 * checked with zod. Throws a structured ProviderError; never reaches the network.
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
