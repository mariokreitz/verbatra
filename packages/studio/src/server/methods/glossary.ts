import type { VerbatraConfig } from "@verbatra/sdk";
import { projectGlossaryIndicator } from "../projection.js";
import { redact } from "../redaction.js";
import type { RpcHandler } from "../rpc.js";

/**
 * Redacts every glossary value before it leaves the server (G16); keys are not free-form user
 * input in the same sense (they are config-authored terms) but are left untouched here since only
 * values are documented as passing through the redaction backstop.
 */
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
 * Wraps the loaded config's resolved glossary: the entries (every value redacted) plus the
 * inline-vs-file indicator read from the loader's own provenance (`deps.config.glossary`),
 * reusing the exact projection helper `project.snapshot` uses for the same field. Strictly
 * read-only; there is no write, edit, or save path anywhere in this handler.
 */
export const glossaryGetHandler: RpcHandler<"glossary.get"> = async (_params, deps) => ({
  indicator: projectGlossaryIndicator(deps.config.glossary, deps.projectRoot),
  entries: redactGlossaryEntries(deps.config.config.glossary),
});
