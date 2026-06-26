import { parse as parseYaml } from "yaml";
import { AdapterError } from "../errors.js";
import { assertJsonRecord, type JsonRecord } from "../json/json-tree.js";

/**
 * Parse untrusted YAML content into a validated object of nested strings, reusing the exact same
 * structure validation as JSON ({@link assertJsonRecord}) with only the syntactic parser swapped: the
 * same depth cap, non-object-root rejection, string-leaf-only guarantee, and null-prototype safety.
 *
 * Anchor-alias expansion is bounded (`maxAliasCount`) so a billion-laughs YAML cannot blow up, and the
 * default core schema is used, which resolves no JS-typed tags to code. The bounded read already caps
 * input bytes before this runs. Malformed YAML is `INVALID_YAML`; a non-object root or a non-string
 * leaf is `INVALID_STRUCTURE`; over-deep nesting is `MAX_DEPTH_EXCEEDED`. Never echoes file content.
 *
 * @param content - The raw YAML file content.
 * @returns The validated {@link JsonRecord}.
 * @throws {@link AdapterError} `INVALID_YAML`, `INVALID_STRUCTURE`, or `MAX_DEPTH_EXCEEDED`.
 */
export function parseYamlObject(content: string): JsonRecord {
  let parsed: unknown;
  try {
    parsed = parseYaml(content, { maxAliasCount: 100 });
  } catch {
    throw new AdapterError("INVALID_YAML", "The file is not valid YAML.");
  }
  return assertJsonRecord(parsed);
}
