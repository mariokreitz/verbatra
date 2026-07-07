import { createTsupConfig } from "@verbatra/config/tsup";

// The bin entry (index.ts) ships no d.ts; per-entry dts emits declarations only for the library entry
// (lib.ts). The shebang banner is inert on lib.js (Node strips a leading hashbang) and absent from lib.d.ts.
//
// external: ["@verbatra/studio"] keeps the studio command's `await import("@verbatra/studio")` a
// genuine runtime import in the built dist/index.js instead of tsup inlining it. @verbatra/studio is
// a devDependency only, never a dependency or peerDependency, so tsup would not externalize it by
// default.
export default createTsupConfig({
  entry: ["src/index.ts", "src/lib.ts"],
  format: ["esm"],
  dts: { entry: "src/lib.ts" },
  banner: { js: "#!/usr/bin/env node" },
  external: ["@verbatra/studio"],
});
