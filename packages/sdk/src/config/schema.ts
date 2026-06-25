import { supportedFormatSchema } from "@verbatra/core";
import { z } from "zod";
import { LOCALE_TOKEN } from "../paths.js";
import { providerConfigSchema } from "./provider-config.js";

/**
 * The verbatra project configuration. Non-secret only: it carries no API key (the
 * provider reads its key from the environment), and unknown top-level keys are rejected
 * so a stray secret cannot hide in the config. Validated with zod at the boundary
 * regardless of where it was loaded from.
 */
/**
 * The default maximum sub-batch size used when `maxBatchSize` is absent from the config. 50 is a
 * conservative count: large enough that the common small project still sends a single request, small
 * enough that a big locale splits into requests that stay well inside provider context windows for the
 * short strings typical of i18n. Applied at the translate boundary, mirroring how `prune` defaults.
 */
export const DEFAULT_MAX_BATCH_SIZE = 50;

export const verbatraConfigSchema = z
  .strictObject({
    sourceLocale: z.string().min(1),
    targetLocales: z.array(z.string().min(1)).min(1),
    format: supportedFormatSchema,
    files: z.strictObject({
      pattern: z.string().min(1),
    }),
    provider: providerConfigSchema,
    glossary: z.record(z.string(), z.string()).optional(),
    tone: z.enum(["formal", "informal", "neutral"]).optional(),
    /**
     * Opt-in orphan pruning, off by default (absent is treated as false). When true, keys present in a
     * target file but absent from the source (the diff's orphaned keys) are removed from the written file
     * and the lock. A per-run `prune` option on `translate` (the CLI `--prune` flag) overrides this. This
     * is non-secret, consistent with the config's no-secret invariant.
     */
    prune: z.boolean().optional(),
    /**
     * Opt-in plural-category generation, off by default (absent is treated as false). When true, and only
     * for an i18next-JSON project translated by an LLM provider, verbatra synthesizes the CLDR plural forms
     * a target language requires but the source does not supply (for example Polish few/many). A per-run
     * `generatePlurals` option on `translate` overrides this. Unsupported cases (DeepL, non-i18next, an
     * unknown language) fall back to the per-locale plural warning.
     */
    generatePlurals: z.boolean().optional(),
    /**
     * Optional maximum number of entries sent in a single provider request. A locale's missing-plus-changed
     * entries are split into sequential sub-batches no larger than this so one oversized request cannot sink
     * the whole locale; a failed sub-batch is withheld and retried while the others still make progress.
     * Must be a positive integer (non-integer, zero, or negative is rejected at this boundary, never
     * coerced). When absent, {@link DEFAULT_MAX_BATCH_SIZE} applies: 50, a conservative count that stays
     * well inside provider context windows for typical short i18n strings while keeping request counts low.
     */
    maxBatchSize: z.number().int().positive().optional(),
  })
  .refine((config) => !config.targetLocales.includes(config.sourceLocale), {
    message: "targetLocales must not include the source locale",
    path: ["targetLocales"],
  })
  .refine((config) => config.files.pattern.includes(LOCALE_TOKEN), {
    message: `files.pattern must contain the ${LOCALE_TOKEN} token`,
    path: ["files", "pattern"],
  });

export type VerbatraConfig = z.infer<typeof verbatraConfigSchema>;
