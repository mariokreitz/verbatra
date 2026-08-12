/**
 * The pure domain center of verbatra: format-agnostic primitives for diffing, content hashing,
 * placeholder integrity, and validation. It performs no I/O, no network, and no file-system access,
 * and knows nothing about specific formats or providers.
 *
 * @packageDocumentation
 */

export { diffResources } from "./diff/diff-resources.js";
export type { DiffOptions, DiffResult } from "./diff/types.js";
export { contentHash } from "./hash/content-hash.js";
export { stableStringHash } from "./hash/string-hash.js";
export type { LocaleResource } from "./model/locale-resource.js";
export {
  SUPPORTED_FORMATS,
  type SupportedFormat,
  supportedFormatSchema,
} from "./model/supported-format.js";
export { type TranslationEntry, translationEntrySchema } from "./model/translation-entry.js";

export { checkPlaceholders } from "./placeholder/integrity.js";
export type { PlaceholderIntegrityResult } from "./placeholder/types.js";
export type { PlaceholderFinding } from "./validation/types.js";
export {
  assessValueDegeneracy,
  type ValueDegeneracyAssessment,
} from "./validation/value-degeneracy.js";
