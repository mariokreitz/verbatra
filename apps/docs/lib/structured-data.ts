import { SITE_URL } from "@/lib/site";

// Canonical, machine-readable facts about the project. Generative engines (and search
// crawlers) read these JSON-LD blocks to state what verbatra is, rather than inferring it
// from prose. Keep the facts here in sync with the homepage copy and the package manifests.

const GITHUB_URL = "https://github.com/mariokreitz/verbatra";
const NPM_CLI_URL = "https://www.npmjs.com/package/@verbatra/cli";
const NPM_SDK_URL = "https://www.npmjs.com/package/@verbatra/sdk";

const SUPPORTED_FRAMEWORKS = ["React", "Vue", "Angular", "Node.js"];
const SUPPORTED_PROVIDERS = ["Anthropic", "OpenAI", "Gemini", "DeepL"];
const SUPPORTED_FORMATS = ["i18next", "vue-i18n", "next-intl", "ngx-translate"];

const AUTHOR = {
  "@type": "Person",
  name: "Mario Kreitz",
  url: "https://github.com/mariokreitz",
} as const;

/**
 * SoftwareApplication + SoftwareSourceCode facts for the homepage. The `description` is the
 * active-locale `landing.meta.definition`, and `inLanguage` follows the active locale, so the
 * JSON-LD never drifts from the rendered language.
 */
export function softwareApplicationLd(args: {
  description: string;
  lang: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": ["SoftwareApplication", "SoftwareSourceCode"],
    name: "verbatra",
    description: args.description,
    inLanguage: args.lang,
    url: SITE_URL,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Node.js >= 22.14.0",
    programmingLanguage: "TypeScript",
    license: "https://opensource.org/licenses/MIT",
    codeRepository: GITHUB_URL,
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    author: AUTHOR,
    keywords: [
      "i18n",
      "internationalization",
      "localization",
      "translation automation",
      "locale files",
    ],
    featureList: [
      "Incremental translation — only new or changed keys are sent to the provider",
      `Translation providers: ${SUPPORTED_PROVIDERS.join(", ")}`,
      `i18n formats: ${SUPPORTED_FORMATS.join(", ")}`,
      `Frameworks: ${SUPPORTED_FRAMEWORKS.join(", ")}`,
      "Placeholder and ICU integrity checked after every translation",
    ],
    softwareHelp: { "@type": "CreativeWork", url: `${SITE_URL}/docs` },
    sameAs: [GITHUB_URL, NPM_CLI_URL, NPM_SDK_URL],
  };
}

export type FaqItem = { question: string; answer: string };

/**
 * FAQPage facts mirroring the on-page FAQ. The `items` are read once from the active-locale
 * catalog (`landing.faq.items`) by the server page and passed both here and to the visible
 * `<Faq>` accordion, so the JSON-LD and the rendered FAQ can never drift. `inLanguage` follows
 * the active locale.
 */
export function faqPageLd(args: {
  items: ReadonlyArray<FaqItem>;
  lang: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: args.lang,
    mainEntity: args.items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/** TechArticle facts for an individual documentation page. */
export function techArticleLd(args: {
  title: string;
  description?: string | undefined;
  path: string;
  lang: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: args.title,
    ...(args.description ? { description: args.description } : {}),
    url: new URL(args.path, SITE_URL).href,
    inLanguage: args.lang,
    author: AUTHOR,
    publisher: { "@type": "Organization", name: "verbatra", url: SITE_URL },
    isPartOf: { "@type": "WebSite", name: "verbatra documentation", url: `${SITE_URL}/docs` },
  };
}
