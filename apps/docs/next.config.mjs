import path from "node:path";
import { createMDX } from "fumadocs-mdx/next";
import createNextIntlPlugin from "next-intl/plugin";

const config = {
  reactStrictMode: true,
  poweredByHeader: false,
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

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(withMDX(config));
