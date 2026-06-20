import { createTsupConfig } from "@verbatra/config/tsup";

// Bundle the three private runtime internals into the published dist (they are never published);
// every real npm dependency stays external and is declared in dependencies.
export default createTsupConfig({
  noExternal: [
    "@verbatra/core",
    "@verbatra/format-adapters",
    "@verbatra/ai-providers",
    "@verbatra/exchange",
  ],
});
