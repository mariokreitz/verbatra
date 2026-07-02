import { Callout } from "fumadocs-ui/components/callout";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/json-ld";
import { getMDXComponents } from "@/components/mdx";
import { i18n, type Locale } from "@/lib/i18n";
import { source } from "@/lib/source";
import { techArticleLd } from "@/lib/structured-data";

export default async function Page(props: { params: Promise<{ slug?: string[]; lang: string }> }) {
  const params = await props.params;
  const lang = params.lang as Locale;
  const page = source.getPage(params.slug, lang);
  if (!page) notFound();

  const MDX = page.data.body;

  // The docs home renders its own full-bleed hero (with its own h1), so the default title,
  // description, table of contents, breadcrumb, and prev/next footer are suppressed there. The
  // article also drops its max-width and padding for the home so the hero can span the full
  // content area edge to edge; the home MDX re-contains the below-hero content in <DocsHomeBody>.
  // The footer is dropped because its single "next" card renders full width (there is no prev)
  // and duplicates the home's entry cards, which are the real, uniform-size navigation. Every
  // other page keeps the standard docs chrome.
  const isHome = !params.slug || params.slug.length === 0;

  // Non-English docs pages are machine-translated (UI strings by verbatra, content by hand),
  // so a transparency notice links back to the authoritative English original. The home is
  // excluded so the notice never sits above the full-bleed hero.
  const isTranslated = lang !== i18n.defaultLanguage;
  const englishHref = `/docs${params.slug && params.slug.length > 0 ? `/${params.slug.join("/")}` : ""}`;
  const translationNote =
    isTranslated && !isHome
      ? await getTranslations({ locale: lang, namespace: "docs.machineTranslated" })
      : null;

  return (
    <DocsPage
      toc={isHome ? [] : page.data.toc}
      full={isHome}
      breadcrumb={{ enabled: !isHome }}
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
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[]; lang: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug, params.lang as Locale);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: { canonical: page.url },
    openGraph: {
      type: "article",
      title: page.data.title,
      description: page.data.description,
      url: page.url,
    },
  };
}
