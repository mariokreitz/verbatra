import type { TranslationEntry } from "@verbatra/core";
import { AdapterError } from "../errors.js";
import { decodeKeyToSegments } from "./key-encoding.js";

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

export function unflattenEntries(entries: ReadonlyMap<string, TranslationEntry>): MutableTree {
  const root: MutableTree = new Map();
  for (const [key, entry] of entries) {
    setPath(root, decodeKeyToSegments(key), entry.value);
  }
  return root;
}
