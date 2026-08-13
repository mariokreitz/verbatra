import { createArbAdapter } from "./arb/arb-adapter.js";
import { createI18nextJsonAdapter } from "./i18next/i18next-adapter.js";
import { createNextIntlJsonAdapter } from "./next-intl/next-intl-adapter.js";
import { createNgxTranslateJsonAdapter } from "./ngx-translate/ngx-translate-adapter.js";
import { createPropertiesAdapter } from "./properties/properties-adapter.js";
import { AdapterRegistry } from "./registry.js";
import { createVueI18nJsonAdapter } from "./vue-i18n/vue-i18n-adapter.js";
import { createXliffAdapter } from "./xliff/xliff-adapter.js";
import { createYamlAdapter } from "./yaml/yaml-adapter.js";

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
