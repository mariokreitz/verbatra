/**
 * Next.js configuration for the documentation site. The default export is the base config wrapped
 * first by the Fumadocs MDX plugin and then by the next-intl plugin.
 */
import path from "node:path";
import { createMDX } from "fumadocs-mdx/next";
import createNextIntlPlugin from "next-intl/plugin";

/**
 * The base Next.js config, before the MDX and next-intl plugins wrap it.
 *
 * `experimental.optimizePackageImports` tree-shakes the icon barrel and motion so that only the
 * used exports ship (Vercel 2.1).
 *
 * `redirects()` folds the www host onto the apex domain, and keeps inbound links to the old
 * "testing" concept page alive after its rename to "translation-safety". That rename needs two
 * entries because English is unprefixed while de, es, and fr carry a locale prefix.
 *
 * `headers()` sets the app-layer security headers for every route. CSP and HSTS are deliberately
 * not here: they are handled at the host/edge.
 */
const config = {
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  experimental: {
    optimizePackageImports: ["@icons-pack/react-simple-icons", "motion"],
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.verbatra.kreitz-webdev.de" }],
        destination: "https://verbatra.kreitz-webdev.de/:path*",
        permanent: true,
      },
      {
        source: "/docs/testing",
        destination: "/docs/translation-safety",
        permanent: true,
      },
      {
        source: "/:locale(de|es|fr)/docs/testing",
        destination: "/:locale/docs/translation-safety",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

const withMDX = createMDX();

/** next-intl acts as a message-catalog provider only; Fumadocs owns routing. */
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(withMDX(config));
