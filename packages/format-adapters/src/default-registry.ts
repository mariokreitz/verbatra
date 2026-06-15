import { createI18nextJsonAdapter } from "./i18next/i18next-adapter.js";
import { createNextIntlJsonAdapter } from "./next-intl/next-intl-adapter.js";
import { createNgxTranslateJsonAdapter } from "./ngx-translate/ngx-translate-adapter.js";
import { AdapterRegistry } from "./registry.js";
import { createVueI18nJsonAdapter } from "./vue-i18n/vue-i18n-adapter.js";

/**
 * Build an {@link AdapterRegistry} pre-loaded with the four v1 JSON adapters (i18next, vue-i18n,
 * next-intl, ngx-translate).
 *
 * @returns A registry ready to resolve any v1 format.
 * @example
 * ```ts
 * const registry = createDefaultRegistry();
 * const resolution = registry.resolve("locales/en.json", { format: "vue-i18n-json" });
 * ```
 */
export function createDefaultRegistry(): AdapterRegistry {
  return new AdapterRegistry()
    .register(createI18nextJsonAdapter())
    .register(createVueI18nJsonAdapter())
    .register(createNextIntlJsonAdapter())
    .register(createNgxTranslateJsonAdapter());
}
