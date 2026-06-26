import { createTsupConfig } from "@verbatra/config/tsup";

// Bundle the private runtime internals into the published dist (they are never published);
// every real npm dependency stays external and is declared in dependencies.
//
// Note: the transitive npm deps of these bundled workspace packages (for example yaml and
// @xmldom/xmldom, pulled in by @verbatra/format-adapters) are intentionally INLINED into the
// dist bundle here. Do NOT add them to @verbatra/sdk dependencies: doing so would make tsup
// externalize them, and the published sdk would then fail at runtime because those deps are not
// installed alongside it.
export default createTsupConfig({
  noExternal: [
    "@verbatra/core",
    "@verbatra/format-adapters",
    "@verbatra/ai-providers",
    "@verbatra/exchange",
  ],
});
