import { supportedFormatSchema } from "@verbatra/core";
import { z } from "zod";
import { LOCALE_TOKEN } from "../locale-path/pattern.js";
import { LOCALE_STYLES } from "../locale-path/style.js";
import { providerConfigSchema } from "./provider-config.js";

export const DEFAULT_MAX_BATCH_SIZE = 50;

export const DEFAULT_BUDGET_BEHAVIOR = "warn" as const;

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

export const verbatraConfigSchema = z
  .strictObject({
    sourceLocale: z.string().min(1),
    targetLocales: z.array(z.string().min(1)).min(1),
    format: supportedFormatSchema,
    files: z.strictObject({
      pattern: z.string().min(1),
      localeStyle: z.enum(LOCALE_STYLES).optional(),
    }),
    provider: providerConfigSchema,
    glossary: z.union([z.record(z.string(), z.string()), z.string().min(1)]).optional(),
    tone: z.enum(["formal", "informal", "neutral"]).optional(),
    prune: z.boolean().optional(),
    generatePlurals: z.boolean().optional(),
    maxBatchSize: z.number().int().positive().optional(),
    maxTokens: z.number().int().positive().optional(),
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

export type VerbatraConfigInput = z.infer<typeof verbatraConfigSchema>;

export type VerbatraConfig = Omit<VerbatraConfigInput, "glossary"> & {
  glossary?: Readonly<Record<string, string>>;
};
