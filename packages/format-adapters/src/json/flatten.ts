import type { TranslationEntry } from "@verbatra/core";
import { AdapterError } from "../errors.js";
import type { JsonRecord } from "./json-tree.js";
import { encodeSegment, joinEncodedSegments } from "./key-encoding.js";

/**
 * Derive the format-specific parts of an entry from its leaf key and value. Each
 * adapter supplies its own (i18next decides isPlural from the key suffix, vue-i18n
 * from a pipe in the value, and so on).
 */
export type DeriveEntry = (
  key: string,
  value: string,
) => { readonly placeholders: readonly string[]; readonly isPlural: boolean };

/**
 * How a JSON adapter treats a dotted string key.
 *
 * - `literal-leaf` (i18next, vue-i18n, next-intl): a dotted string key is a single
 *   literal leaf. Its dots are encoded so the flattened map key stays distinct from a
 *   real nested path, and the leaf round-trips with its original shape on write.
 * - `path-notation` (ngx-translate flat style): a dotted string key denotes a nested
 *   path. No encoding is applied, preserving the pre-existing behavior exactly; the
 *   flat-vs-nested write style is handled by the adapter's own write-tree builder.
 */
export type KeyMode = "literal-leaf" | "path-notation";

interface FlattenContext {
  readonly namespace: string;
  readonly derive: DeriveEntry;
  readonly out: Map<string, TranslationEntry>;
  /** Effective logical path -> the map key that claimed it, for collision detection. */
  readonly claimed: Map<string, string>;
}

/**
 * Record a leaf, encoding its segment path into a map key and rejecting a genuine
 * collision: a literal dotted leaf and a real nested path that resolve to the same
 * effective logical path within one file are ambiguous and fail loudly.
 */
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

/** Walk a node, building encoded leaf keys from the segment path to each string value. */
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

/** Path-notation flatten: join segments with a plain dot, no encoding (legacy behavior). */
function addPathEntries(
  node: JsonRecord,
  prefix: string,
  namespace: string,
  derive: DeriveEntry,
  out: Map<string, TranslationEntry>,
): void {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix === "" ? key : `${prefix}.${key}`;
    if (typeof value === "string") {
      const { placeholders, isPlural } = derive(key, value);
      out.set(path, { key: path, namespace, value, placeholders, isPlural });
    } else {
      addPathEntries(value, path, namespace, derive, out);
    }
  }
}

/**
 * Flatten a nested JSON object into ordered TranslationEntry records keyed by dotted
 * path, deriving placeholders and isPlural per the adapter's rule. A Map is used
 * (never a plain object), so hostile keys such as __proto__ are inert data and cannot
 * pollute any prototype. Document order is preserved.
 *
 * In `literal-leaf` mode (the default), a dotted string key is a single literal leaf:
 * its dots are encoded so its map key is distinct from a real nested path, and a true
 * collision between a literal leaf and a nested path resolving to the same effective
 * path throws `INVALID_STRUCTURE`. In `path-notation` mode (ngx-translate flat style)
 * a dotted string key denotes a nested path and is flattened without encoding, exactly
 * as before. A segment containing no dot or backslash encodes to itself, so dotted-free
 * files produce byte-identical map keys in either mode.
 */
export function flattenTree(
  tree: JsonRecord,
  namespace: string,
  derive: DeriveEntry,
  keyMode: KeyMode = "literal-leaf",
): Map<string, TranslationEntry> {
  const out = new Map<string, TranslationEntry>();
  if (keyMode === "path-notation") {
    addPathEntries(tree, "", namespace, derive, out);
    return out;
  }
  addEntries({ namespace, derive, out, claimed: new Map() }, [], tree);
  return out;
}
