import type { z } from "zod";
import { SdkError } from "../errors.js";
import { type VerbatraConfigInput, verbatraConfigSchema } from "./schema.js";

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      const base = path.length > 0 ? `${path}: ${issue.message}` : issue.message;
      return issue.code === "unrecognized_keys"
        ? `${base} (API keys are read from the environment, not the config)`
        : base;
    })
    .join("; ");
}

export function parseConfig(input: unknown): VerbatraConfigInput {
  const parsed = verbatraConfigSchema.safeParse(input);
  if (!parsed.success) {
    throw new SdkError(
      "CONFIG_INVALID",
      `The verbatra configuration is invalid: ${formatIssues(parsed.error)}`,
    );
  }
  return parsed.data;
}
