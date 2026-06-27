import { createTsupConfig } from "@verbatra/config/tsup";

// The bin entry (index.ts) ships no d.ts; per-entry dts emits declarations only for the library entry
// (lib.ts). The shebang banner is inert on lib.js (Node strips a leading hashbang) and absent from lib.d.ts.
export default createTsupConfig({
  entry: ["src/index.ts", "src/lib.ts"],
  format: ["esm"],
  dts: { entry: "src/lib.ts" },
  banner: { js: "#!/usr/bin/env node" },
});
