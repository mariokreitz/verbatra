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

  // The right-hand table of contents (rendered by DocsPage's default `toc` slot) already
  // gives page-level wayfinding, so the breadcrumb trail is redundant chrome and stays off
  // for every page, not just the home.
  //
  // "Edit this page" points at this exact page's own source file (`page.path`, relative to
  // `content/docs`), including its locale suffix where one applies, so a reader editing the
  // German page lands on `page.de.mdx`, the file that actually produced what they are
  // reading, not the English source they cannot use to fix it. The home is excluded, same as
  // the breadcrumb and footer, since it has no matching content file to edit.
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

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[]; lang: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug, params.lang as Locale);
  if (!page) notFound();

  // Per-page hreflang alternates: pair each translation of this page so search engines serve
  // the right locale. The sitemap carries the same signal; page-level link tags reinforce it.
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
    // Set the Twitter card explicitly so shared docs pages show this page's title and
    // description, not the site-wide defaults inherited from the layout.
    twitter: {
      card: "summary_large_image",
      title: page.data.title,
      description: page.data.description,
      images: ["/og-image.png"],
    },
  };
}
