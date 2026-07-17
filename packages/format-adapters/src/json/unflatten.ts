import type { TranslationEntry } from "@verbatra/core";
import { AdapterError } from "../errors.js";
import { decodeKeyToSegments } from "./key-encoding.js";

/** A mutable ordered tree under construction. A Map is inherently immune to prototype pollution, so hostile key segments such as __proto__ stay inert data. */
type MutableTree = Map<string, string | MutableTree>;

function descend(node: MutableTree, segment: string): MutableTree {
  const next = node.get(segment);
  if (next === undefined) {
    const created: MutableTree = new Map();
    node.set(segment, created);
    return created;
  }
  if (next instanceof Map) {
    return next;
  }
  throw new AdapterError("INVALID_STRUCTURE", "A leaf key collides with a nested key path.");
}

function setPath(root: MutableTree, segments: readonly string[], value: string): void {
  const leaf = segments.at(-1);
  if (leaf === undefined) {
    return;
  }
  let node = root;
  for (const segment of segments.slice(0, -1)) {
    node = descend(node, segment);
  }
  if (node.get(leaf) instanceof Map) {
    throw new AdapterError("INVALID_STRUCTURE", "A leaf key collides with a nested key path.");
  }
  node.set(leaf, value);
}

/**
 * Rebuild an ordered nested tree from ordered entries, decoding each map key on its unescaped dots so
 * a literal dotted leaf is restored as a single leaf and a real nested path splits into structure.
 * Containers are Maps, so segments like __proto__ stay inert and the entries' insertion order
 * survives to the written file verbatim, at every nesting level.
 *
 * @throws {@link AdapterError} `INVALID_STRUCTURE` when a leaf key collides with a nested key path.
 */
export function unflattenEntries(entries: ReadonlyMap<string, TranslationEntry>): MutableTree {
  const root: MutableTree = new Map();
  for (const [key, entry] of entries) {
    setPath(root, decodeKeyToSegments(key), entry.value);
  }
  return root;
}
