import { SITE_URL } from "@/lib/site";

const GITHUB_URL = "https://github.com/mariokreitz/verbatra";
const NPM_CLI_URL = "https://www.npmjs.com/package/@verbatra/cli";
const NPM_SDK_URL = "https://www.npmjs.com/package/@verbatra/sdk";
const NPM_STUDIO_URL = "https://www.npmjs.com/package/@verbatra/studio";

const SUPPORTED_FRAMEWORKS = ["React", "Vue", "Angular", "Node.js", "Flutter"];
const SUPPORTED_PROVIDERS = ["Anthropic", "OpenAI", "Gemini", "DeepL", "openai-compatible"];
const SUPPORTED_FORMATS = [
  "i18next",
  "vue-i18n",
  "next-intl",
  "ngx-translate",
  "ARB",
  "YAML",
  "XLIFF",
];

const AUTHOR = {
  "@type": "Person",
  name: "Mario Kreitz",
  url: "https://github.com/mariokreitz",
} as const;

export function softwareApplicationLd(args: {
  description: string;
  lang: string;
  version: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": ["SoftwareApplication", "SoftwareSourceCode"],
    name: "verbatra",
    softwareVersion: args.version,
    description: args.description,
    inLanguage: args.lang,
    url: SITE_URL,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Node.js >= 22.14.0",
    programmingLanguage: "TypeScript",
    license: "https://opensource.org/licenses/MIT",
    codeRepository: GITHUB_URL,
    downloadUrl: NPM_CLI_URL,
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
      "Incremental translation - only new or changed keys are sent to the provider",
      `Translation providers: ${SUPPORTED_PROVIDERS.join(", ")}`,
      `i18n formats: ${SUPPORTED_FORMATS.join(", ")}`,
      `Frameworks: ${SUPPORTED_FRAMEWORKS.join(", ")}`,
      "Placeholder and ICU integrity checked after every translation",
    ],
    softwareHelp: { "@type": "CreativeWork", url: `${SITE_URL}/docs` },
    sameAs: [GITHUB_URL, NPM_CLI_URL, NPM_SDK_URL, NPM_STUDIO_URL],
  };
}

/**
 * WebSite entity for the docs site. Deliberately emitted without a
 * SearchAction: the site search is a client-side dialog backed by the JSON
 * endpoint /api/search, so there is no crawlable search results URL to
 * declare honestly.
 */
export function websiteLd(args: { lang: string }): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "verbatra",
    url: SITE_URL,
    inLanguage: args.lang,
    author: AUTHOR,
    publisher: { "@type": "Organization", name: "verbatra", url: SITE_URL },
  };
}

export type BreadcrumbLdItem = { name: string; url?: string | undefined };

/**
 * BreadcrumbList mirroring the trail rendered by the Fumadocs breadcrumb.
 * Section crumbs that are not links in the UI (route groups without an index
 * page) are emitted name-only; no URL is fabricated for them.
 */
export function breadcrumbListLd(args: {
  items: ReadonlyArray<BreadcrumbLdItem>;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: args.items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      ...(item.url ? { item: new URL(item.url, SITE_URL).href } : {}),
    })),
  };
}

export type FaqItem = { question: string; answer: string };

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

export type HowToStepItem = { name: string; text: string };

export function howToLd(args: {
  name: string;
  steps: ReadonlyArray<HowToStepItem>;
  lang: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: args.name,
    inLanguage: args.lang,
    step: args.steps.map((item, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: item.name,
      text: item.text,
    })),
  };
}

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
