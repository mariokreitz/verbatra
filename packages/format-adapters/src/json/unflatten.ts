import type { TranslationEntry } from "@verbatra/core";
import { AdapterError } from "../errors.js";

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
  node[leaf] = value;
}

/**
 * Rebuild a nested object from ordered entries, splitting dotted keys back into
 * structure. Containers are null-prototype objects, so segments like __proto__ are
 * inert. Insertion order follows entry order, preserving the original key order.
 */
export function unflattenEntries(entries: ReadonlyMap<string, TranslationEntry>): MutableTree {
  const root = emptyNode();
  for (const [key, entry] of entries) {
    setPath(root, key.split("."), entry.value);
  }
  return root;
}
