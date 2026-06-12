import type { TranslationEntry } from "@verbatra/core";
import type { JsonRecord } from "./json-tree.js";

/**
 * Derive the format-specific parts of an entry from its leaf key and value. Each
 * adapter supplies its own (i18next decides isPlural from the key suffix, vue-i18n
 * from a pipe in the value, and so on).
 */
export type DeriveEntry = (
  key: string,
  value: string,
) => { readonly placeholders: readonly string[]; readonly isPlural: boolean };

function addEntries(
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
      addEntries(value, path, namespace, derive, out);
    }
  }
}

/**
 * Flatten a nested JSON object into ordered TranslationEntry records keyed by dotted
 * path, deriving placeholders and isPlural per the adapter's rule. A Map is used
 * (never a plain object), so hostile keys such as __proto__ are inert data and cannot
 * pollute any prototype. Document order is preserved.
 */
export function flattenTree(
  tree: JsonRecord,
  namespace: string,
  derive: DeriveEntry,
): Map<string, TranslationEntry> {
  const out = new Map<string, TranslationEntry>();
  addEntries(tree, "", namespace, derive, out);
  return out;
}
