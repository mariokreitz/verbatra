import type { RunSummary } from "@verbatra/sdk";
import { z } from "zod";

export const TRANSLATE_PENDING_METHOD = "translation.translatePending";

export const translatePendingParamsSchema = z.strictObject({});

export type TranslatePendingParams = z.infer<typeof translatePendingParamsSchema>;

export type TranslatePendingResult = RunSummary;
