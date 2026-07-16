import { createTsupConfig } from "@verbatra/config/tsup";

/** The server-side build: the shared tsup preset, ESM only. The SPA is built separately by Vite. */
export default createTsupConfig({
  format: ["esm"],
});
