import type { FormatAdapter } from "../adapter.js";
import { icuDeriveEntry, icuInvalidKeys, icuIsValid, icuPlaceholders } from "../icu/analyze.js";
import { compareIcuPlaceholders } from "../icu/compare.js";
import { assertJsonRecord, type JsonRecord, serializeJsonTree } from "../json/json-tree.js";
import { createTreeFileAdapter } from "../json/tree-file-adapter.js";
import {
  buildArbWriteTree,
  extractArbDescriptions,
  parseArbObject,
  stripArbMetadata,
} from "./metadata.js";

/** Strip `@`-prefixed metadata before validation, since it legitimately holds non-string and deeply nested leaves that the message-tree validation would reject. */
function parseArb(content: string): JsonRecord {
  return assertJsonRecord(stripArbMetadata(parseArbObject(content)));
}

/**
 * The Flutter ARB adapter: JSON with a flat object of message keys alongside `@`-prefixed metadata.
 * Metadata is stripped on read (never translated) and merged back on write through
 * {@link buildArbWriteTree}, preserving its document order. Message values are ICU MessageFormat.
 * Each `@<key>.description` is additionally read into the matching entry's `description` field via
 * {@link extractArbDescriptions}, as disambiguation context for the translator and the model; this
 * does not change what gets written back, since `description` is never part of the ARB write tree.
 *
 * @returns A `FormatAdapter` for `arb`. Its `read`/`write` throw the shared structured conditions
 *   documented on {@link createTreeFileAdapter} (INVALID_JSON, MAX_DEPTH_EXCEEDED, INVALID_STRUCTURE,
 *   INPUT_TOO_LARGE). Invalid ICU is RECORDED in `invalidIcuKeys`, not thrown.
 * @example
 * ```ts
 * const adapter = createArbAdapter();
 * const { resource } = await adapter.read("lib/l10n/app_en.arb", "en");
 * ```
 */
export function createArbAdapter(): FormatAdapter {
  return createTreeFileAdapter({
    format: "arb",
    extensions: [".arb"],
    sniff: (sample) => sample.trimStart().startsWith("{"),
    parse: parseArb,
    serialize: serializeJsonTree,
    extractPlaceholders: icuPlaceholders,
    deriveEntry: icuDeriveEntry,
    computeInvalidIcuKeys: icuInvalidKeys,
    validateMessage: icuIsValid,
    comparePlaceholders: compareIcuPlaceholders,
    buildWriteTree: buildArbWriteTree,
    deriveDescriptions: extractArbDescriptions,
  });
}
