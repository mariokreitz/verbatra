import "../global.css";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { notFound } from "next/navigation";
import Script from "next/script";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { i18n, type Locale } from "@/lib/i18n";
import { i18nConfig } from "@/lib/layout.shared";
import { SITE_URL } from "@/lib/site";

const sans = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });

/** Static params for every supported locale. */
export function generateStaticParams(): Array<{ lang: string }> {
  return i18n.languages.map((lang) => ({ lang }));
}

/** Site-wide metadata for the locale: title template, hreflang alternates, OpenGraph, and Twitter card. */
export async function generateMetadata(props: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await props.params;
  const t = await getTranslations({ locale: lang, namespace: "landing.meta" });
  const title = t("title");
  const description = t("description");
  const ogImageAlt = t("ogImageAlt");
  const canonical = lang === i18n.defaultLanguage ? "/" : `/${lang}`;

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: "%s | verbatra" },
    description,
    alternates: {
      canonical,
      languages: {
        en: "/",
        de: "/de",
        es: "/es",
        fr: "/fr",
        "x-default": "/",
      },
    },
    openGraph: {
      type: "website",
      siteName: "verbatra",
      locale: lang,
      url: new URL(canonical, SITE_URL).href,
      title,
      description,
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: ogImageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og-image.png"],
    },
  };
}

/** Browser theme color matching the dark site background. */
export const viewport: Viewport = {
  themeColor: "#0B0B12",
};

/**
 * Root layout for a locale: validates the URL locale, loads its message
 * catalog, and mounts the next-intl and Fumadocs providers plus the Umami
 * analytics script. Unknown locales 404.
 */
export default async function Layout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>;
  children: ReactNode;
}) {
  const { lang } = await params;
  if (!(i18n.languages as readonly string[]).includes(lang)) notFound();
  const locale = lang as Locale;
  setRequestLocale(locale);
  const messages = await getMessages({ locale });

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`dark ${sans.variable} ${mono.variable} ${display.variable}`}
    >
      <head>
        <link rel="preconnect" href="https://umami.kreitz-webdev.de" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://umami.kreitz-webdev.de" />
      </head>
      <body className="flex flex-col min-h-screen">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <RootProvider theme={{ enabled: false }} i18n={i18nConfig(locale)}>
            {children}
          </RootProvider>
        </NextIntlClientProvider>
        <Script
          defer
          src="https://umami.kreitz-webdev.de/script.js"
          data-website-id="2ade0fc1-62ec-4f3c-a3cd-2ce7fcb14d86"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
