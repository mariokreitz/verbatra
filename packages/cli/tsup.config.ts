import { createTsupConfig } from "@verbatra/config/tsup";

/**
 * Bundles the bin entry (index.ts) and the library entry (lib.ts) as ESM. Only lib.ts gets a d.ts;
 * the shebang banner is inert on lib.js (Node strips a leading hashbang) and absent from lib.d.ts.
 * `external: ["@verbatra/studio"]` keeps the studio command's `await import("@verbatra/studio")` a
 * genuine runtime import in dist/index.js instead of tsup inlining it; @verbatra/studio is a
 * devDependency only, so tsup would not externalize it by default.
 */
export default createTsupConfig({
  entry: ["src/index.ts", "src/lib.ts"],
  format: ["esm"],
  dts: { entry: "src/lib.ts" },
  banner: { js: "#!/usr/bin/env node" },
  external: ["@verbatra/studio"],
});
