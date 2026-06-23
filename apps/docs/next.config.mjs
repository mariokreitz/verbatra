import path from "node:path";
import { createMDX } from "fumadocs-mdx/next";
import createNextIntlPlugin from "next-intl/plugin";

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.verbatra.kreitz-webdev.de" }],
        destination: "https://verbatra.kreitz-webdev.de/:path*",
        permanent: true,
      },
    ];
  },
  // App-layer security headers for every route. CSP and Strict-Transport-Security are
  // intentionally deferred to a follow-up / edge config: CSP needs careful allowlisting of
  // the font and inline needs, and HSTS belongs at the host/edge (an ops decision).
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
// next-intl as a message-catalog provider only (Fumadocs owns routing). Points the plugin
// at the per-request config that resolves the active locale and loads messages/{locale}.json.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(withMDX(config));
