import type { FormatAdapter } from "../adapter.js";
import { icuDeriveEntry, icuInvalidKeys, icuIsValid, icuPlaceholders } from "../icu/analyze.js";
import { assertJsonRecord, type JsonRecord, serializeJsonTree } from "../json/json-tree.js";
import { createTreeFileAdapter } from "../json/tree-file-adapter.js";
import { buildArbWriteTree, parseArbObject, stripArbMetadata } from "./metadata.js";

/**
 * Parse ARB content into its translatable messages. Metadata is `@`-prefixed and commonly carries
 * non-string and deeply nested leaves (for example `optionalParameters.decimalDigits`), so it is
 * stripped from the raw parsed object BEFORE the string-leaf and depth validation runs. Only the
 * remaining message keys are validated as a message tree; the metadata is preserved for write by
 * {@link buildArbWriteTree}, which re-reads the destination.
 */
function parseArb(content: string): JsonRecord {
  return assertJsonRecord(stripArbMetadata(parseArbObject(content)));
}

/**
 * The Flutter ARB adapter. ARB is JSON syntax with a flat object of message keys alongside
 * `@`-prefixed metadata keys. Metadata is stripped on read (never translated) and merged back on
 * write through {@link buildArbWriteTree}, which re-reads the destination and preserves its metadata
 * and document order. Message values are ICU MessageFormat, so placeholders, plurality, and message
 * validity reuse the shared ICU analysis exactly as next-intl does.
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
    buildWriteTree: buildArbWriteTree,
  });
}
