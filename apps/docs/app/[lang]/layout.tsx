import "../global.css";
import { RootProvider } from "fumadocs-ui/provider/base";
import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { notFound } from "next/navigation";
import Script from "next/script";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { JsonLd } from "@/components/json-ld";
import { LocaleAwareFrameworkProvider } from "@/lib/framework-provider";
import { i18n, type Locale } from "@/lib/i18n";
import { i18nConfig } from "@/lib/layout.shared";
import { ogAlternateLocales, ogLocale, SITE_URL } from "@/lib/site";
import { AUTHOR_NAME, SEO_KEYWORDS, websiteLd } from "@/lib/structured-data";

const sans = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });

export function generateStaticParams(): Array<{ lang: string }> {
  return i18n.languages.map((lang) => ({ lang }));
}

export async function generateMetadata(props: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await props.params;
  const t = await getTranslations({ locale: lang, namespace: "landing.meta" });
  const title = t("title");
  const ogTitle = t("ogTitle");
  const description = t("description");
  const ogDescription = t("ogDescription");
  const ogImageAlt = t("ogImageAlt");
  const canonical = lang === i18n.defaultLanguage ? "/" : `/${lang}`;

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: "%s | verbatra" },
    description,
    keywords: [...SEO_KEYWORDS],
    authors: [{ name: AUTHOR_NAME, url: "https://github.com/mariokreitz" }],
    creator: AUTHOR_NAME,
    publisher: "verbatra",
    formatDetection: { telephone: false, email: false, address: false },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
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
      locale: ogLocale(lang as Locale),
      alternateLocale: ogAlternateLocales(lang as Locale),
      url: new URL(canonical, SITE_URL).href,
      title: ogTitle,
      description: ogDescription,
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: ogImageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      site: "@mariokreitz",
      creator: "@mariokreitz",
      title,
      description,
      images: ["/og-image.png"],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#0B0B12",
};

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
        <JsonLd data={websiteLd({ lang: locale })} />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <LocaleAwareFrameworkProvider>
            <RootProvider theme={{ enabled: false }} i18n={i18nConfig(locale)}>
              {children}
            </RootProvider>
          </LocaleAwareFrameworkProvider>
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
