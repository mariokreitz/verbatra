import "./global.css";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { SITE_URL } from "@/lib/site";

const TAGLINE = "Keep your locale files in sync. Translate only what changed.";

// Site-wide metadata defaults. Per-page titles fill the "%s | verbatra" template.
// The social-card image is added once the banner asset lands (cropped to 1200x630).
// The homepage carries the self-referencing canonical here; docs pages override it
// (and og:title / og:type / og:url) in their own generateMetadata.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "verbatra", template: "%s | verbatra" },
  description: TAGLINE,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "verbatra",
    url: SITE_URL,
    title: "verbatra",
    description: TAGLINE,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "verbatra" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "verbatra",
    description: TAGLINE,
    images: ["/og-image.png"],
  },
};

// Inter carries prose, JetBrains Mono carries code and the file-path nav labels, and
// Space Grotesk stays the display/wordmark face. The CSS variables here are mapped onto
// --font-sans / --font-mono / --font-display in global.css.
const sans = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable} ${display.variable}`}
    >
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
