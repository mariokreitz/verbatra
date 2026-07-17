import { z } from "zod";

/** The RPC method name for the read-only glossary view. */
export const GLOSSARY_GET_METHOD = "glossary.get";

/** Takes no parameters: the glossary always reflects the single loaded project. */
export const glossaryGetParamsSchema = z.strictObject({});

/** Parsed `glossary.get` params. */
export type GlossaryGetParams = z.infer<typeof glossaryGetParamsSchema>;

/**
 * Where a project's glossary came from, mirroring the sdk's own provenance domain: absent, an
 * inline record in the config, or a file whose path is shown relativized against the project
 * root. The view never infers this from the config shape; it always comes from the loader's own
 * result.
 */
export type GlossaryIndicator =
  | { readonly source: "none" }
  | { readonly source: "inline" }
  | { readonly source: "file"; readonly path: string };

/** The glossary entries, redacted, plus their provenance. Strictly read-only; no write affordance. */
export interface GlossaryGetResult {
  readonly indicator: GlossaryIndicator;
  readonly entries: Readonly<Record<string, string>>;
}
