export type { FormatAdapter, ReadResult } from "./adapter.js";
export { createDefaultRegistry } from "./default-registry.js";
export { AdapterError, type AdapterErrorCode } from "./errors.js";
export { createI18nextJsonAdapter } from "./i18next/i18next-adapter.js";
export { AdapterRegistry, type AdapterResolution, type ResolveOptions } from "./registry.js";
export { createVueI18nJsonAdapter } from "./vue-i18n/vue-i18n-adapter.js";
