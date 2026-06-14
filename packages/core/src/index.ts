/**
 * The pure domain center of verbatra: format-agnostic primitives for diffing, content hashing,
 * placeholder integrity, and validation. It performs no I/O, no network, and no file-system access,
 * and knows nothing about specific formats or providers.
 *
 * @packageDocumentation
 */

// Diffing
export { diffResources } from "./diff/diff-resources.js";
export type { DiffOptions, DiffResult } from "./diff/types.js";
// Content hash
export { contentHash } from "./hash/content-hash.js";
// Domain model
export {
  type LocaleResource,
  localeResourceSchema,
  parseLocaleResource,
} from "./model/locale-resource.js";
export {
  SUPPORTED_FORMATS,
  type SupportedFormat,
  supportedFormatSchema,
} from "./model/supported-format.js";
export {
  parseTranslationEntry,
  type TranslationEntry,
  translationEntrySchema,
} from "./model/translation-entry.js";

// Placeholder integrity
export { checkPlaceholders } from "./placeholder/integrity.js";
export type { PlaceholderIntegrityResult } from "./placeholder/types.js";
export type {
  PlaceholderFinding,
  ValidateOptions,
  ValidationFinding,
  ValidationReport,
} from "./validation/types.js";
// Validation
export { validate } from "./validation/validate.js";
