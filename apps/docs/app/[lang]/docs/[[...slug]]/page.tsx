import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/json-ld";
import { getMDXComponents } from "@/components/mdx";
import type { Locale } from "@/lib/i18n";
import { source } from "@/lib/source";
import { techArticleLd } from "@/lib/structured-data";

export default async function Page(props: { params: Promise<{ slug?: string[]; lang: string }> }) {
  const params = await props.params;
  const lang = params.lang as Locale;
  const page = source.getPage(params.slug, lang);
  if (!page) notFound();

  const MDX = page.data.body;

  // The docs home renders its own full-bleed hero (with its own h1), so the default title,
  // description, table of contents, and breadcrumb are suppressed there and the page runs
  // full width. Every other page keeps the standard docs chrome.
  const isHome = !params.slug || params.slug.length === 0;

  return (
    <DocsPage toc={isHome ? [] : page.data.toc} full={isHome} breadcrumb={{ enabled: !isHome }}>
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
