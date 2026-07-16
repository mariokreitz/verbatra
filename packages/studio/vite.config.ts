import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * The SPA build config. Root points at the SPA source; the build writes into dist/app so it
 * survives tsup's dist/ clean when the two build steps run in order (see package.json's build
 * script). `assetsInlineLimit` is forced to 0 so no asset is ever inlined as a data: URI, which
 * keeps every response servable from the static assets root with a stable path.
 */
export default defineConfig({
  root: "src/app",
  base: "/",
  plugins: [tailwindcss(), react()],
  build: {
    outDir: "../../dist/app",
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
});
