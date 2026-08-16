import type { GlossaryIndicator, GlossaryWriteResult } from "../shared/rpc/glossary.js";
import { resolveErrorCopy } from "./error-copy.js";
import type { RpcCallResult } from "./rpc-client.js";

export type GlossaryWriteOutcome =
  | { readonly kind: "success"; readonly glossary: GlossaryWriteResult }
  | { readonly kind: "error"; readonly message: string };

export function deriveGlossaryWriteOutcome(
  response: RpcCallResult<"glossary.write">,
): GlossaryWriteOutcome {
  if (!response.ok) {
    return { kind: "error", message: resolveErrorCopy(response.error) };
  }
  return { kind: "success", glossary: response.result };
}

export function glossaryReadOnlyReason(indicator: GlossaryIndicator): string | undefined {
  if (indicator.source === "inline") {
    return (
      "This glossary is written inline in the verbatra config, which is a code module Studio will " +
      "not rewrite. Move the terms into a JSON file and set the config's glossary to that path to " +
      "edit them here."
    );
  }
  if (indicator.source === "none") {
    return (
      "This project has no glossary yet. Create a JSON file of term to translation pairs and set " +
      "the config's glossary to that path to manage the terms here."
    );
  }
  return undefined;
}

export function isGlossaryEditable(indicator: GlossaryIndicator): boolean {
  return glossaryReadOnlyReason(indicator) === undefined;
}
