import { describe, expect, it } from "vitest";
import {
  defaultModuleAliasDeps,
  type ModuleAliasDeps,
  resolveSelfPackageAliases,
} from "./module-aliases.js";

describe("resolveSelfPackageAliases", () => {
  it("aliases @verbatra/sdk and @verbatra/cli to the resolved entry file of the nearest candidate that has them", () => {
    const deps: ModuleAliasDeps = {
      resolvePaths: () => ["/nearest/node_modules", "/far/node_modules"],
      readPackageManifest: (packageRoot) => {
        if (packageRoot === "/nearest/node_modules/@verbatra/sdk") {
          return { exports: { ".": { import: "./dist/index.js", require: "./dist/index.cjs" } } };
        }
        if (packageRoot === "/far/node_modules/@verbatra/cli") {
          return { exports: { ".": { import: "./dist/lib.js" } } };
        }
        return undefined;
      },
    };

    const aliases = resolveSelfPackageAliases(deps);

    expect(aliases).toEqual({
      "@verbatra/sdk": "/nearest/node_modules/@verbatra/sdk/dist/index.js",
      "@verbatra/cli": "/far/node_modules/@verbatra/cli/dist/lib.js",
    });
  });

  it("resolves an import-only exports map, the shape @verbatra/cli actually publishes", () => {
    const deps: ModuleAliasDeps = {
      resolvePaths: () => ["/node_modules"],
      readPackageManifest: () => ({ exports: { ".": { import: "./dist/lib.js" } } }),
    };

    expect(resolveSelfPackageAliases(deps)["@verbatra/cli"]).toBe(
      "/node_modules/@verbatra/cli/dist/lib.js",
    );
  });

  it("prefers the import condition over require when both are present", () => {
    const deps: ModuleAliasDeps = {
      resolvePaths: () => ["/node_modules"],
      readPackageManifest: () => ({
        exports: { ".": { require: "./dist/index.cjs", import: "./dist/index.js" } },
      }),
    };

    expect(resolveSelfPackageAliases(deps)["@verbatra/sdk"]).toBe(
      "/node_modules/@verbatra/sdk/dist/index.js",
    );
  });

  it("falls back to a string exports value with no conditions", () => {
    const deps: ModuleAliasDeps = {
      resolvePaths: () => ["/node_modules"],
      readPackageManifest: () => ({ exports: "./dist/index.js" }),
    };

    expect(resolveSelfPackageAliases(deps)["@verbatra/sdk"]).toBe(
      "/node_modules/@verbatra/sdk/dist/index.js",
    );
  });

  it("falls back to main when there is no exports field", () => {
    const deps: ModuleAliasDeps = {
      resolvePaths: () => ["/node_modules"],
      readPackageManifest: () => ({ main: "./index.js" }),
    };

    expect(resolveSelfPackageAliases(deps)["@verbatra/sdk"]).toBe(
      "/node_modules/@verbatra/sdk/index.js",
    );
  });

  it("prefers the nearest candidate over a farther one that also has the package", () => {
    const deps: ModuleAliasDeps = {
      resolvePaths: () => ["/nearest/node_modules", "/far/node_modules"],
      readPackageManifest: (packageRoot) =>
        packageRoot.startsWith("/nearest") || packageRoot.startsWith("/far")
          ? { main: "./index.js" }
          : undefined,
    };

    expect(resolveSelfPackageAliases(deps)["@verbatra/sdk"]).toBe(
      "/nearest/node_modules/@verbatra/sdk/index.js",
    );
  });

  it("skips a candidate directory with no package.json and falls through to the next", () => {
    const deps: ModuleAliasDeps = {
      resolvePaths: () => ["/missing/node_modules", "/real/node_modules"],
      readPackageManifest: (packageRoot) =>
        packageRoot === "/real/node_modules/@verbatra/sdk" ? { main: "./index.js" } : undefined,
    };

    expect(resolveSelfPackageAliases(deps)["@verbatra/sdk"]).toBe(
      "/real/node_modules/@verbatra/sdk/index.js",
    );
  });

  it("skips a manifest that has neither a resolvable exports entry nor main", () => {
    const deps: ModuleAliasDeps = {
      resolvePaths: () => ["/node_modules"],
      readPackageManifest: () => ({}),
    };

    expect(resolveSelfPackageAliases(deps)).toEqual({});
  });

  it("omits a package that cannot be found in any candidate directory", () => {
    const deps: ModuleAliasDeps = {
      resolvePaths: (packageName) => (packageName === "@verbatra/sdk" ? ["/only"] : []),
      readPackageManifest: (packageRoot) =>
        packageRoot === "/only/@verbatra/sdk" ? { main: "./index.js" } : undefined,
    };

    const aliases = resolveSelfPackageAliases(deps);

    expect(aliases).toEqual({ "@verbatra/sdk": "/only/@verbatra/sdk/index.js" });
    expect(aliases["@verbatra/cli"]).toBeUndefined();
  });

  it("returns an empty object when neither package can be found", () => {
    const deps: ModuleAliasDeps = {
      resolvePaths: () => [],
      readPackageManifest: () => undefined,
    };

    expect(resolveSelfPackageAliases(deps)).toEqual({});
  });

  it("uses the real resolution deps by default without throwing", () => {
    expect(() => resolveSelfPackageAliases()).not.toThrow();
    const aliases = resolveSelfPackageAliases();
    for (const value of Object.values(aliases)) {
      expect(typeof value).toBe("string");
    }
  });

  it("the default deps resolve candidate directories and read a package.json", () => {
    expect(defaultModuleAliasDeps.resolvePaths("@verbatra/sdk").length).toBeGreaterThan(0);
    expect(
      defaultModuleAliasDeps.readPackageManifest("/definitely/not/a/real/path"),
    ).toBeUndefined();
  });
});
