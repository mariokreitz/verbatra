import { createI18nextJsonAdapter } from "./i18next/i18next-adapter.js";
import { createNextIntlJsonAdapter } from "./next-intl/next-intl-adapter.js";
import { AdapterRegistry } from "./registry.js";
import { createVueI18nJsonAdapter } from "./vue-i18n/vue-i18n-adapter.js";

/** A registry pre-loaded with the v1 JSON adapters. */
export function createDefaultRegistry(): AdapterRegistry {
  return new AdapterRegistry()
    .register(createI18nextJsonAdapter())
    .register(createVueI18nJsonAdapter())
    .register(createNextIntlJsonAdapter());
}
