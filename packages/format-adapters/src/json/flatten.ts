import type { TranslationEntry } from "@verbatra/core";
import { AdapterError } from "../errors.js";
import type { JsonRecord } from "./json-tree.js";
import { encodeSegment, joinEncodedSegments } from "./key-encoding.js";

/** Derive the format-specific parts of an entry (placeholders, plurality) from its leaf key and value. */
export type DeriveEntry = (
  key: string,
  value: string,
) => { readonly placeholders: readonly string[]; readonly isPlural: boolean };

/**
 * How a JSON adapter treats a dotted string key.
 *
 * - `literal-leaf`: a dotted string key is a single literal leaf; its dots are encoded so the
 *   map key stays distinct from a real nested path, and the leaf round-trips unchanged on write.
 * - `path-notation`: a dotted string key denotes a nested path and is flattened without encoding.
 */
export type KeyMode = "literal-leaf" | "path-notation";

interface FlattenContext {
  readonly namespace: string;
  readonly derive: DeriveEntry;
  readonly out: Map<string, TranslationEntry>;
  /** Effective logical path -> the map key that claimed it, for collision detection. */
  readonly claimed: Map<string, string>;
}

function addLeaf(
  ctx: FlattenContext,
  segments: readonly string[],
  key: string,
  value: string,
): void {
  const effectivePath = segments.join(".");
  const mapKey = joinEncodedSegments(segments.map(encodeSegment));
  if (ctx.claimed.has(effectivePath) && ctx.claimed.get(effectivePath) !== mapKey) {
    throw new AdapterError(
      "INVALID_STRUCTURE",
      "A literal dotted leaf key and a nested key path resolve to the same path.",
    );
  }
  ctx.claimed.set(effectivePath, mapKey);
  const { placeholders, isPlural } = ctx.derive(key, value);
  ctx.out.set(mapKey, { key: mapKey, namespace: ctx.namespace, value, placeholders, isPlural });
}

function addEntries(ctx: FlattenContext, prefix: readonly string[], node: JsonRecord): void {
  for (const [key, value] of Object.entries(node)) {
    const segments = [...prefix, key];
    if (typeof value === "string") {
      addLeaf(ctx, segments, key, value);
    } else {
      addEntries(ctx, segments, value);
    }
  }
}

/**
 * Path-notation flatten: join segments with a plain dot, no encoding. Since there is no encoding
 * to tell a dotted leaf key apart from a nested path in this mode, the map key and the effective
 * path are always identical. Because every distinct path can only be produced once by a genuine
 * nested-object traversal (object keys within one node are unique), a resolved path being touched
 * a second time, in either role (leaf or branch), can only happen through the dotted/nested
 * ambiguity itself. `claimedPaths` records every path touched so far regardless of role, so it
 * catches all three shapes of collision: a dotted leaf clashing with a nested leaf at the same
 * final path, a dotted leaf whose path is also used as an ancestor by a deeper nested leaf, and a
 * dotted leaf that is itself the ancestor of a deeper nested leaf (in either processing order).
 */
function addPathEntries(
  node: JsonRecord,
  prefix: string,
  namespace: string,
  derive: DeriveEntry,
  out: Map<string, TranslationEntry>,
  claimedPaths: Set<string>,
): void {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix === "" ? key : `${prefix}.${key}`;
    if (claimedPaths.has(path)) {
      throw new AdapterError(
        "INVALID_STRUCTURE",
        "A dotted key and a nested key path resolve to the same path.",
      );
    }
    claimedPaths.add(path);
    if (typeof value === "string") {
      const { placeholders, isPlural } = derive(key, value);
      out.set(path, { key: path, namespace, value, placeholders, isPlural });
    } else {
      addPathEntries(value, path, namespace, derive, out, claimedPaths);
    }
  }
}

/**
 * Flatten a nested JSON object into ordered TranslationEntry records keyed by dotted path,
 * preserving document order and deriving placeholders and isPlural per the adapter's rule.
 * A Map (never a plain object) keeps hostile keys such as __proto__ as inert data.
 *
 * In `literal-leaf` mode (the default) a dotted string key is a single literal leaf and a true
 * collision with a nested path resolving to the same effective path throws `INVALID_STRUCTURE`.
 * In `path-notation` mode a dotted string key denotes a nested path and is flattened without
 * encoding; a dotted leaf key whose path collides with a nested key path is a collision and throws
 * `INVALID_STRUCTURE` instead of silently dropping or restructuring a value, whether the two paths
 * are exactly equal, or one is a strict ancestor of the other, in either processing order.
 *
 * @param tree - The parsed nested object.
 * @param namespace - The namespace recorded on each entry.
 * @param derive - Per-leaf placeholder and plurality derivation.
 * @param keyMode - How dotted string keys are interpreted (defaults to `literal-leaf`).
 * @throws {@link AdapterError} `INVALID_STRUCTURE` on a literal-leaf vs nested-path collision, in
 *   either key mode.
 */
export function flattenTree(
  tree: JsonRecord,
  namespace: string,
  derive: DeriveEntry,
  keyMode: KeyMode = "literal-leaf",
): Map<string, TranslationEntry> {
  const out = new Map<string, TranslationEntry>();
  if (keyMode === "path-notation") {
    addPathEntries(tree, "", namespace, derive, out, new Set());
    return out;
  }
  addEntries({ namespace, derive, out, claimed: new Map() }, [], tree);
  return out;
}
