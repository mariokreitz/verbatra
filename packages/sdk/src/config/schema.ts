import { supportedFormatSchema } from "@verbatra/core";
import { z } from "zod";
import { LOCALE_TOKEN } from "../paths.js";
import { providerConfigSchema } from "./provider-config.js";

// Default sub-batch size when maxBatchSize is absent: small enough that a big locale splits into
// requests that stay inside provider context windows, large enough that a small project sends one.
export const DEFAULT_MAX_BATCH_SIZE = 50;

// Default budget behavior when maxTokens is set but budgetBehavior is absent: flag the overrun without
// interrupting the run, matching how every other withholding path in this SDK degrades gracefully by
// default rather than stopping.
export const DEFAULT_BUDGET_BEHAVIOR = "warn" as const;

/**
 * The first target locale that collides case-insensitively with an earlier one in the same list, if
 * any. Two entries differing only in case (or an exact duplicate) resolve to the same Excel worksheet
 * name on export, so they must be rejected here rather than surfacing as a raw exceljs error later.
 */
function findCaseInsensitiveDuplicate(locales: readonly string[]): string | undefined {
  const seen = new Set<string>();
  for (const locale of locales) {
    const key = locale.toLowerCase();
    if (seen.has(key)) {
      return locale;
    }
    seen.add(key);
  }
  return undefined;
}

/**
 * The verbatra project configuration. It carries no API key (the provider reads its key from the
 * environment), and unknown top-level keys are rejected so a stray secret cannot hide in it. Validated
 * with zod at the boundary regardless of where it was loaded from.
 */
export const verbatraConfigSchema = z
  .strictObject({
    sourceLocale: z.string().min(1),
    targetLocales: z.array(z.string().min(1)).min(1),
    format: supportedFormatSchema,
    files: z.strictObject({
      pattern: z.string().min(1),
    }),
    provider: providerConfigSchema,
    /**
     * A glossary of source terms to preferred target terms, either inline or as a path to a JSON file
     * carrying the same shape. The two forms are mutually exclusive by type; there is no merge or
     * precedence between them. A path is resolved and validated by the loader, not by this schema; see
     * `resolve-glossary.ts`.
     */
    glossary: z.union([z.record(z.string(), z.string()), z.string().min(1)]).optional(),
    tone: z.enum(["formal", "informal", "neutral"]).optional(),
    /**
     * Opt-in orphan pruning, off by default. When true, keys present in a target file but absent from
     * the source are removed from the written file and the lock. The per-run `prune` option on
     * `translate` (the CLI `--prune` flag) overrides this.
     */
    prune: z.boolean().optional(),
    /**
     * Opt-in plural-category generation, off by default. When true, and only for an i18next-JSON project
     * translated by an LLM provider, verbatra synthesizes the CLDR plural forms a target language
     * requires but the source does not supply (for example Polish few/many). The per-run
     * `generatePlurals` option on `translate` overrides this. Unsupported cases (DeepL, non-i18next, an
     * unknown language) fall back to the per-locale plural warning.
     */
    generatePlurals: z.boolean().optional(),
    /**
     * Optional maximum number of entries sent in a single provider request. A locale's missing and
     * changed entries are split into sequential sub-batches no larger than this, so one oversized request
     * cannot sink the whole locale; a failed sub-batch is withheld while the others make progress. Must
     * be a positive integer (zero, negative, or non-integer is rejected, never coerced). When absent,
     * {@link DEFAULT_MAX_BATCH_SIZE} applies.
     */
    maxBatchSize: z.number().int().positive().optional(),
    /**
     * Optional whole-run token ceiling (input plus output tokens summed across every provider call, main
     * translation and plural generation alike, across all target locales). Checked after each completed
     * sub-batch, never mid-batch: the sub-batch whose completion crosses the ceiling is retained and
     * counted, since a call already in flight cannot be undone. Must be a positive integer. Config-only,
     * no CLI flag. Absent means no budget is enforced. Inert (never a false trip) against a token-less
     * provider such as DeepL, since it never reports usage to measure against the ceiling.
     */
    maxTokens: z.number().int().positive().optional(),
    /**
     * What happens once `maxTokens` is reached: `"warn"` (default) flags it and lets the run continue
     * unchanged; `"stop"` withholds every not-yet-attempted key for the rest of the run (the current
     * locale's remaining candidates and every later locale's), retried automatically next run. Present
     * without `maxTokens` is accepted and has no effect. Never changes the command's exit code.
     */
    budgetBehavior: z.enum(["warn", "stop"]).optional(),
  })
  .refine((config) => !config.targetLocales.includes(config.sourceLocale), {
    message: "targetLocales must not include the source locale",
    path: ["targetLocales"],
  })
  .refine((config) => findCaseInsensitiveDuplicate(config.targetLocales) === undefined, {
    error: (issue) => {
      const duplicate = findCaseInsensitiveDuplicate(
        (issue.input as { targetLocales: readonly string[] }).targetLocales,
      );
      return `targetLocales must not contain case-insensitively duplicate locales: "${duplicate}"`;
    },
    path: ["targetLocales"],
  })
  .refine((config) => config.files.pattern.includes(LOCALE_TOKEN), {
    message: `files.pattern must contain the ${LOCALE_TOKEN} token`,
    path: ["files", "pattern"],
  });

/**
 * The as-authored (or as-parsed) shape of the verbatra configuration, straight from the schema: `glossary`
 * is still the union of an inline record or a file path. {@link defineConfig} and the authoring types are
 * built on this; `loadConfig` accepts it as input and produces the resolved {@link VerbatraConfig}.
 */
export type VerbatraConfigInput = z.infer<typeof verbatraConfigSchema>;

/**
 * The verbatra configuration after `loadConfig` has resolved it: identical to {@link VerbatraConfigInput}
 * except `glossary`, which is always a plain record here. A glossary given as a file path is read,
 * parsed, and validated by the loader before a `VerbatraConfig` is produced, so every downstream
 * consumer (the translation flow, `watch`, the CLI) keeps receiving the same resolved shape it always
 * did.
 */
export type VerbatraConfig = Omit<VerbatraConfigInput, "glossary"> & {
  glossary?: Readonly<Record<string, string>>;
};
