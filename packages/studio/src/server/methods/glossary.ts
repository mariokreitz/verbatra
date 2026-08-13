import type { VerbatraConfig } from "@verbatra/sdk";
import { projectGlossaryIndicator } from "../projection.js";
import { redact } from "../redaction.js";
import type { RpcHandler } from "../rpc.js";

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

export const glossaryGetHandler: RpcHandler<"glossary.get"> = async (_params, deps) => ({
  indicator: projectGlossaryIndicator(deps.config.glossary, deps.projectRoot),
  entries: redactGlossaryEntries(deps.config.config.glossary),
});
