import type { TranslationEntry } from "@verbatra/core";
import { AdapterError } from "../errors.js";
import { decodeKeyToSegments } from "./key-encoding.js";

type MutableTree = { [key: string]: string | MutableTree };

/** A null-prototype container, so input key segments can never pollute a prototype. */
function emptyNode(): MutableTree {
  return Object.create(null) as MutableTree;
}

function descend(node: MutableTree, segment: string): MutableTree {
  const next = node[segment];
  if (next === undefined) {
    const created = emptyNode();
    node[segment] = created;
    return created;
  }
  if (typeof next === "object") {
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
  if (typeof node[leaf] === "object") {
    throw new AdapterError("INVALID_STRUCTURE", "A leaf key collides with a nested key path.");
  }
  node[leaf] = value;
}

/**
 * Rebuild a nested object from ordered entries, decoding each map key on its unescaped dots so a
 * literal dotted leaf is restored as a single leaf and a real nested path splits into structure.
 * Containers are null-prototype objects so segments like __proto__ stay inert. Entry order is preserved.
 *
 * @throws {@link AdapterError} `INVALID_STRUCTURE` when a leaf key collides with a nested key path.
 */
export function unflattenEntries(entries: ReadonlyMap<string, TranslationEntry>): MutableTree {
  const root = emptyNode();
  for (const [key, entry] of entries) {
    setPath(root, decodeKeyToSegments(key), entry.value);
  }
  return root;
}
