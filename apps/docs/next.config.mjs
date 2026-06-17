import path from "node:path";
import { createMDX } from "fumadocs-mdx/next";

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Emit a self-contained server bundle for Docker/Dokploy.
  output: "standalone",
  // Trace files from the monorepo root so the pnpm store is included in the bundle.
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
};

const withMDX = createMDX();

export default withMDX(config);
