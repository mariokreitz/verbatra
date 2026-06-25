/**
 * Read and write locale files in each supported format into and out of core's intermediate
 * representation. Provides the {@link FormatAdapter} extension point and an {@link AdapterRegistry} to
 * resolve one for a file; the four v1 JSON adapters (i18next, vue-i18n, next-intl, ngx-translate) all
 * built on the shared {@link createJsonFileAdapter} factory; the placeholder-syntax knowledge the
 * provider integrity check validates against; and the security hardening of the read/write paths
 * (atomic temp-then-rename writes, a bounded TOCTOU-safe read with size and depth caps, and structured
 * secret-free {@link AdapterError}s).
 *
 * @packageDocumentation
 */

export type { FormatAdapter, ReadResult } from "./adapter.js";
export { createDefaultRegistry } from "./default-registry.js";
export { AdapterError, type AdapterErrorCode } from "./errors.js";
export { createI18nextJsonAdapter } from "./i18next/i18next-adapter.js";
export {
  type I18nextPluralCategory,
  isPluralKey,
  makePluralKey,
  pluralBaseKey,
  pluralCategoryOf,
} from "./i18next/plural.js";
export { createNextIntlJsonAdapter } from "./next-intl/next-intl-adapter.js";
export { createNgxTranslateJsonAdapter } from "./ngx-translate/ngx-translate-adapter.js";
export { AdapterRegistry, type AdapterResolution, type ResolveOptions } from "./registry.js";
export { createVueI18nJsonAdapter } from "./vue-i18n/vue-i18n-adapter.js";
