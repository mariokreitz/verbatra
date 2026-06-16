import { createTsupConfig } from "@verbatra/config/tsup";

// Two entries: the executable bin (index.ts — ESM, Node shebang, no d.ts, nothing imports it) and a
// side-effect-free library entry (lib.ts) that ships declaration types so consumers can import
// defineConfig and the config type. Per-entry dts keeps the bin declaration-free. The shebang banner
// is global; it is inert on lib.js (Node strips a leading hashbang from any module it loads), and the
// emitted lib.d.ts carries no banner.
export default createTsupConfig({
  entry: ["src/index.ts", "src/lib.ts"],
  format: ["esm"],
  dts: { entry: "src/lib.ts" },
  banner: { js: "#!/usr/bin/env node" },
});
