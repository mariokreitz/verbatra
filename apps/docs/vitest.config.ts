import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Vitest for the documentation site. Deliberately not built on the shared
 * `@verbatra/config` preset: that preset bakes in the 90 percent coverage gate the
 * publishable packages are held to, and this app is a Next.js site whose pages are
 * not unit tested. The scope here is the pure helpers under `lib/`, the few components
 * whose behavior is worth pinning, and the route modules under `app/` that produce data
 * rather than markup (the sitemap), so the include globs are narrow and no coverage
 * threshold is declared.
 *
 * The `@/` alias mirrors the tsconfig `paths` entry that Next resolves at build time,
 * so component modules can be imported under test exactly as they are in the app.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    include: ["lib/**/*.test.ts", "components/**/*.test.tsx", "app/**/*.test.ts"],
  },
});
