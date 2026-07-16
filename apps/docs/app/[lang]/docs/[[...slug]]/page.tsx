import { Callout } from "fumadocs-ui/components/callout";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  EditOnGitHub,
} from "fumadocs-ui/layouts/docs/page";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/json-ld";
import { getMDXComponents } from "@/components/mdx";
import { i18n, type Locale } from "@/lib/i18n";
import { source } from "@/lib/source";
import { techArticleLd } from "@/lib/structured-data";

/**
 * Renders a docs page from the Fumadocs source. The docs home ships its own
 * full-bleed hero, so title, description, table of contents, footer, and page
 * padding are suppressed there; every other page keeps the standard chrome.
 * Non-English pages get a translation notice linking to the English original,
 * and "Edit this page" points at the page's own locale-suffixed source file.
 */
export default async function Page(props: { params: Promise<{ slug?: string[]; lang: string }> }) {
  const params = await props.params;
  const lang = params.lang as Locale;
  const page = source.getPage(params.slug, lang);
  if (!page) notFound();

  const MDX = page.data.body;

  const isHome = !params.slug || params.slug.length === 0;

  const isTranslated = lang !== i18n.defaultLanguage;
  const englishHref = `/docs${params.slug && params.slug.length > 0 ? `/${params.slug.join("/")}` : ""}`;
  const translationNote =
    isTranslated && !isHome
      ? await getTranslations({ locale: lang, namespace: "docs.machineTranslated" })
      : null;

  const editHref = isHome
    ? null
    : `https://github.com/mariokreitz/verbatra/blob/main/apps/docs/content/docs/${page.path}`;

  return (
    <DocsPage
      toc={isHome ? [] : page.data.toc}
      full={isHome}
      breadcrumb={{ enabled: false }}
      footer={{ enabled: !isHome }}
      className={isHome ? "max-w-none p-0 md:p-0 xl:p-0" : undefined}
    >
      <JsonLd
        data={techArticleLd({
          title: page.data.title,
          description: page.data.description,
          path: page.url,
          lang,
        })}
      />
      {isHome ? null : (
        <>
          <DocsTitle>{page.data.title}</DocsTitle>
          <DocsDescription>{page.data.description}</DocsDescription>
        </>
      )}
      <DocsBody>
        {translationNote ? (
          <Callout type="info" title={translationNote("title")}>
            {translationNote("text")}{" "}
            <Link href={englishHref}>{translationNote("viewOriginal")}</Link>.
          </Callout>
        ) : null}
        <MDX components={getMDXComponents()} />
        {editHref ? <EditOnGitHub href={editHref} /> : null}
      </DocsBody>
    </DocsPage>
  );
}

/** Static params for every docs page in every locale. */
export function generateStaticParams() {
  return source.generateParams();
}

/**
 * Per-page metadata with hreflang alternates pairing each translation of the
 * page, plus OpenGraph and Twitter cards carrying this page's own title and
 * description instead of the layout defaults.
 */
export async function generateMetadata(props: {
  params: Promise<{ slug?: string[]; lang: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug, params.lang as Locale);
  if (!page) notFound();

  const languages: Record<string, string> = {};
  for (const altLocale of i18n.languages) {
    const altPage = source.getPage(params.slug, altLocale);
    if (altPage) languages[altLocale] = altPage.url;
  }
  languages["x-default"] = languages[i18n.defaultLanguage] ?? page.url;

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: { canonical: page.url, languages },
    openGraph: {
      type: "article",
      title: page.data.title,
      description: page.data.description,
      url: page.url,
      images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: page.data.title,
      description: page.data.description,
      images: ["/og-image.png"],
    },
  };
}
