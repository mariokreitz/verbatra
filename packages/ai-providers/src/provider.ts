import type { PlaceholderIntegrityResult, TranslationEntry } from "@verbatra/core";
import { translationEntrySchema } from "@verbatra/core";
import { z } from "zod";
import { ProviderError } from "./errors.js";

export type ProviderKind = "llm" | "machine-translation";

export type Tone = "formal" | "informal" | "neutral";

export type PlaceholderExtractor = (value: string) => readonly string[];

export type PlaceholderComparator = (
  source: string,
  translated: string,
) => PlaceholderIntegrityResult;

export interface TranslateRequest {
  readonly sourceLocale: string;
  readonly targetLocale: string;
  readonly entries: readonly TranslationEntry[];
  readonly glossary?: Readonly<Record<string, string>>;
  readonly tone?: Tone;
  readonly extractPlaceholders: PlaceholderExtractor;
  readonly comparePlaceholders?: PlaceholderComparator;
  readonly signal?: AbortSignal;
}

export interface Usage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export type ProviderNoticeCode =
  | "FORMALITY_DOWNGRADED"
  | "GLOSSARY_IGNORED"
  | "PLACEHOLDER_UNSUPPORTED";

export interface ProviderNotice {
  readonly code: ProviderNoticeCode;
  readonly message: string;
}

export type ReviewReasonCode =
  | "LENGTH_RATIO_OUTLIER"
  | "EQUALS_SOURCE"
  | "GLOSSARY_TERM_MISSED"
  | "INTEGRITY_REORDERED"
  | "PROVIDER_DEGRADED";

export interface ReviewFlag {
  readonly status: "review";
  readonly reasons: readonly ReviewReasonCode[];
}

export interface TranslateResult {
  readonly values: ReadonlyMap<string, string>;
  readonly integrity: ReadonlyMap<string, PlaceholderIntegrityResult>;
  readonly usage?: Usage;
  readonly notices?: readonly ProviderNotice[];
  readonly reviewFlags?: ReadonlyMap<string, ReviewFlag>;
}

export interface TranslationProvider {
  readonly id: string;
  readonly kind: ProviderKind;
  readonly supportsGlossary: boolean;
  translateBatch(request: TranslateRequest): Promise<TranslateResult>;
}

const requestDataSchema = z.object({
  sourceLocale: z.string().min(1),
  targetLocale: z.string().min(1),
  entries: z.array(translationEntrySchema).min(1),
  glossary: z.record(z.string(), z.string()).optional(),
  tone: z.enum(["formal", "informal", "neutral"]).optional(),
});

export type ValidatedRequestData = z.infer<typeof requestDataSchema>;

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
