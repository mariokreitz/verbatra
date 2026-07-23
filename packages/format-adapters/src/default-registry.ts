import { createArbAdapter } from "./arb/arb-adapter.js";
import { createI18nextJsonAdapter } from "./i18next/i18next-adapter.js";
import { createNextIntlJsonAdapter } from "./next-intl/next-intl-adapter.js";
import { createNgxTranslateJsonAdapter } from "./ngx-translate/ngx-translate-adapter.js";
import { createPropertiesAdapter } from "./properties/properties-adapter.js";
import { AdapterRegistry } from "./registry.js";
import { createVueI18nJsonAdapter } from "./vue-i18n/vue-i18n-adapter.js";
import { createXliffAdapter } from "./xliff/xliff-adapter.js";
import { createYamlAdapter } from "./yaml/yaml-adapter.js";

/**
 * Build an {@link AdapterRegistry} pre-loaded with every shipped adapter: the four JSON i18n adapters
 * (i18next, vue-i18n, next-intl, ngx-translate) plus the non-JSON adapters (XLIFF, YAML, ARB,
 * Java/Spring properties).
 *
 * @returns A registry ready to resolve any supported format.
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
    .register(createNgxTranslateJsonAdapter())
    .register(createXliffAdapter())
    .register(createYamlAdapter())
    .register(createArbAdapter())
    .register(createPropertiesAdapter());
}
