import { defineConfig } from "vitest/config";

/**
 * Vitest for the documentation site. Deliberately not built on the shared
 * `@verbatra/config` preset: that preset bakes in the 90 percent coverage gate the
 * publishable packages are held to, and this app is a Next.js site whose pages and
 * components are not unit tested. The scope here is the pure helpers under `lib/`,
 * so the include glob is narrow and no coverage threshold is declared.
 */
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
  },
});
