import { z } from "zod";

export const GLOSSARY_GET_METHOD = "glossary.get";

export const glossaryGetParamsSchema = z.strictObject({});

export type GlossaryGetParams = z.infer<typeof glossaryGetParamsSchema>;

export type GlossaryIndicator =
  | { readonly source: "none" }
  | { readonly source: "inline" }
  | { readonly source: "file"; readonly path: string };

export interface GlossaryGetResult {
  readonly indicator: GlossaryIndicator;
  readonly entries: Readonly<Record<string, string>>;
}
