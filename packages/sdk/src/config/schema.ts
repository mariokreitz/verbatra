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
