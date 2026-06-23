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

// Inter carries prose, JetBrains Mono carries code and the file-path nav labels, and
// Space Grotesk stays the display/wordmark face. The CSS variables here are mapped onto
// --font-sans / --font-mono / --font-display in global.css.
const sans = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });

export function generateStaticParams(): Array<{ lang: string }> {
  return i18n.languages.map((lang) => ({ lang }));
}

// Per-locale metadata. Description/OG read the active-locale catalog; metadataBase, the
// `%s | verbatra` template, and the canonical/og:url are structural. hreflang alternates are
// emitted for every locale plus an x-default (the unprefixed English root), per the routing IA.
export async function generateMetadata(props: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await props.params;
  const t = await getTranslations({ locale: lang, namespace: "landing.meta" });
  const title = t("title");
  const tagline = t("tagline");
  const ogImageAlt = t("ogImageAlt");
  const canonical = lang === i18n.defaultLanguage ? "/" : `/${lang}`;

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: "%s | verbatra" },
    description: tagline,
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
      description: tagline,
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: ogImageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: tagline,
      images: ["/og-image.png"],
    },
  };
}

// Dark-only: a single theme-color, no light/dark media variants. The value is the
// --color-fd-background dark surface (#0B0B12) so the browser chrome matches the app
// background. Next 16 reads themeColor from the `viewport` export, not from Metadata.
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
      <body className="flex flex-col min-h-screen">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {/* Theme is forced dark app-wide: next-themes is disabled (no toggle renders) and
              the `dark` class is server-rendered on <html>, so first paint is dark with no
              flash-of-light even with OS light + JS disabled. */}
          <RootProvider theme={{ enabled: false }} i18n={i18nConfig(locale)}>
            {children}
          </RootProvider>
        </NextIntlClientProvider>
        {/* Cookieless, self-hosted Umami analytics. No consent banner is required. */}
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
