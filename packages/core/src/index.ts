// Domain model

// Diffing
export { diffResources } from "./diff/diff-resources.js";
export type { DiffOptions, DiffResult } from "./diff/types.js";
// Content hash
export { contentHash } from "./hash/content-hash.js";
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
