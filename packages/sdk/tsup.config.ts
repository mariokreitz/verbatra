import { createTsupConfig } from "@verbatra/config/tsup";

/** Private workspace packages bundled into the published sdk output and its type declarations. */
const WORKSPACE_INTERNALS = [
  "@verbatra/core",
  "@verbatra/format-adapters",
  "@verbatra/ai-providers",
  "@verbatra/exchange",
];

export default createTsupConfig({
  noExternal: WORKSPACE_INTERNALS,
  dts: { resolve: WORKSPACE_INTERNALS },
});
