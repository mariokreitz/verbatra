import { createTsupConfig } from "@verbatra/config/tsup";

// Bundle the private workspace internals into the published dist while keeping every real npm
// dependency external. Transitive deps of those bundled packages (yaml, @xmldom/xmldom) must be
// declared in @verbatra/sdk dependencies so tsup externalizes them rather than inlining them: yaml
// is CommonJS and calls require() internally, which throws under the ESM bundle if inlined.
export default createTsupConfig({
  noExternal: [
    "@verbatra/core",
    "@verbatra/format-adapters",
    "@verbatra/ai-providers",
    "@verbatra/exchange",
  ],
});
