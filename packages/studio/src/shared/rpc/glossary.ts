import { z } from "zod";

export const GLOSSARY_GET_METHOD = "glossary.get";

export const GLOSSARY_WRITE_METHOD = "glossary.write";

export const MAX_GLOSSARY_TERM_LENGTH = 200;

export const MAX_GLOSSARY_TRANSLATION_LENGTH = 2_000;

export const glossaryGetParamsSchema = z.strictObject({});

export type GlossaryGetParams = z.infer<typeof glossaryGetParamsSchema>;

export const glossaryWriteParamsSchema = z.strictObject({
  term: z.string().min(1).max(MAX_GLOSSARY_TERM_LENGTH),
  translation: z.string().min(1).max(MAX_GLOSSARY_TRANSLATION_LENGTH).nullable(),
});

export type GlossaryWriteParams = z.infer<typeof glossaryWriteParamsSchema>;

export type GlossaryIndicator =
  | { readonly source: "none" }
  | { readonly source: "inline" }
  | { readonly source: "file"; readonly path: string };

export interface GlossaryGetResult {
  readonly indicator: GlossaryIndicator;
  readonly entries: Readonly<Record<string, string>>;
  readonly redactedTerms: readonly string[];
}

export type GlossaryWriteResult = GlossaryGetResult;
