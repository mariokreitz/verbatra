/**
 * Read and write locale files in each supported format into and out of core's intermediate
 * representation. Provides the {@link FormatAdapter} extension point and an {@link AdapterRegistry} to
 * resolve one for a file, the placeholder-syntax knowledge the provider integrity check validates
 * against, and hardened read/write paths (atomic writes, bounded reads with size and depth caps, and
 * structured secret-free {@link AdapterError}s).
 *
 * @packageDocumentation
 */

export type { FormatAdapter, ReadResult } from "./adapter.js";
export { createArbAdapter } from "./arb/arb-adapter.js";
export { createDefaultRegistry } from "./default-registry.js";
export { AdapterError, type AdapterErrorCode } from "./errors.js";
export {
  createFlatFileAdapter,
  type FlatFileAdapterOptions,
} from "./flat/flat-file-adapter.js";
export { createI18nextJsonAdapter } from "./i18next/i18next-adapter.js";
export {
  type I18nextPluralCategory,
  isPluralKey,
  makePluralKey,
  pluralBaseKey,
  pluralCategoryOf,
} from "./i18next/plural.js";
export {
  createTreeFileAdapter,
  type TreeFileAdapterOptions,
} from "./json/tree-file-adapter.js";
export { createNextIntlJsonAdapter } from "./next-intl/next-intl-adapter.js";
export { createNgxTranslateJsonAdapter } from "./ngx-translate/ngx-translate-adapter.js";
export { AdapterRegistry, type AdapterResolution, type ResolveOptions } from "./registry.js";
export { createVueI18nJsonAdapter } from "./vue-i18n/vue-i18n-adapter.js";
export { createXliffAdapter } from "./xliff/xliff-adapter.js";
export { createYamlAdapter } from "./yaml/yaml-adapter.js";
