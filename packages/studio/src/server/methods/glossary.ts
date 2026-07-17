import type { VerbatraConfig } from "@verbatra/sdk";
import { projectGlossaryIndicator } from "../projection.js";
import { redact } from "../redaction.js";
import type { RpcHandler } from "../rpc.js";

/** Redacts every glossary value before it leaves the server; keys are config-authored terms and pass through untouched. */
function redactGlossaryEntries(
  glossary: VerbatraConfig["glossary"],
): Readonly<Record<string, string>> {
  if (glossary === undefined) {
    return {};
  }
  const redacted: Record<string, string> = {};
  for (const [key, value] of Object.entries(glossary)) {
    redacted[key] = redact(value);
  }
  return redacted;
}

/**
 * Handles `glossary.get`: returns the loaded config's glossary entries with every value redacted,
 * plus the inline-vs-file indicator projected from the loader's own provenance
 * (`deps.config.glossary`) via the same helper the project snapshot uses. Strictly read-only.
 */
export const glossaryGetHandler: RpcHandler<"glossary.get"> = async (_params, deps) => ({
  indicator: projectGlossaryIndicator(deps.config.glossary, deps.projectRoot),
  entries: redactGlossaryEntries(deps.config.config.glossary),
});
