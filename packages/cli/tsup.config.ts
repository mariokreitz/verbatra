import { createTsupConfig } from "@verbatra/config/tsup";

// The CLI is an executable, not a consumed library: build a single ESM bin entry with a Node
// shebang (added via banner so the source stays plain TS), no CJS, no d.ts (nothing imports it).
export default createTsupConfig({
  format: ["esm"],
  dts: false,
  banner: { js: "#!/usr/bin/env node" },
});
