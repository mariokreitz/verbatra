import { createTsupConfig } from "@verbatra/config/tsup";

// Bundle the private runtime internals into the published dist (they are never published);
// every real npm dependency stays external and is declared in dependencies.
//
// The transitive npm deps of these bundled workspace packages (for example yaml and
// @xmldom/xmldom, pulled in by @verbatra/format-adapters) MUST be declared in
// @verbatra/sdk dependencies so tsup externalizes them. They cannot be inlined: yaml is
// CommonJS and calls require() internally, which throws "Dynamic require ... is not supported"
// under the ESM dist bundle. As declared dependencies they are installed alongside the
// published sdk and resolved normally at runtime, exactly like exceljs and jszip.
export default createTsupConfig({
  noExternal: [
    "@verbatra/core",
    "@verbatra/format-adapters",
    "@verbatra/ai-providers",
    "@verbatra/exchange",
  ],
});
