import path from "node:path";
import { createMDX } from "fumadocs-mdx/next";

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Emit a self-contained server bundle for Docker/Dokploy.
  output: "standalone",
  // Trace files from the monorepo root so the pnpm store is included in the bundle.
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  // Collapse the www host onto the canonical non-www host with a permanent (301) redirect,
  // so ranking signals never split across two hostnames serving identical content. Enforced
  // in-app so it holds regardless of how the proxy is configured.
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
};

const withMDX = createMDX();

export default withMDX(config);
