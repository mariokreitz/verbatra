import { parse as parseYaml } from "yaml";
import { AdapterError } from "../errors.js";
import { assertJsonRecord, type JsonRecord } from "../json/json-tree.js";

/**
 * Parse untrusted YAML into a validated object of nested strings, reusing the same structure
 * validation as JSON ({@link assertJsonRecord}). Anchor-alias expansion is bounded (`maxAliasCount`)
 * so a billion-laughs document cannot blow up, and the default core schema resolves no JS-typed tags.
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
