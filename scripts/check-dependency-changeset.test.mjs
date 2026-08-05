import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  diffResolvedDependencies,
  disclosesPublishedPackage,
  evaluate,
  isReleaseBranch,
  parseChangesetPackages,
  parseWorkspaceCatalogs,
  resolvePublishedDependencies,
} from "./check-dependency-changeset.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** A workspace file with both catalogs, shaped like the real one including comments and quoting. */
const WORKSPACE_YAML = `packages:
  - "packages/*"
  - "apps/*"

# A comment between the packages list and the catalogs.
catalog:
  "@types/node": 26.1.2
  typescript: 6.0.3
  zod: 4.4.3

catalogs:
  bundled:
    "@anthropic-ai/sdk": 0.115.0
    # A comment inside the block must not end it.
    openai: 7.3.0

overrides:
  postcss@<8.5.18: ">=8.5.18 <9"
`;

/** A published manifest mixing a catalog reference, a bundled reference, a literal and a workspace dep. */
const SDK_MANIFEST = JSON.stringify({
  name: "@verbatra/sdk",
  dependencies: {
    "@anthropic-ai/sdk": "catalog:bundled",
    cosmiconfig: "9.0.2",
    openai: "catalog:bundled",
    zod: "catalog:",
  },
});

const CLI_MANIFEST = JSON.stringify({
  name: "@verbatra/cli",
  dependencies: { "@verbatra/sdk": "workspace:*", commander: "15.0.0" },
});

function manifests() {
  return [
    { path: "packages/sdk/package.json", json: SDK_MANIFEST },
    { path: "packages/cli/package.json", json: CLI_MANIFEST },
  ];
}

describe("parseWorkspaceCatalogs", () => {
  it("parses the default catalog and every named catalog", () => {
    const catalogs = parseWorkspaceCatalogs(WORKSPACE_YAML);

    expect(Object.keys(catalogs).sort()).toEqual(["bundled", "default"]);
    expect(catalogs.default).toEqual({
      "@types/node": "26.1.2",
      typescript: "6.0.3",
      zod: "4.4.3",
    });
    expect(catalogs.bundled).toEqual({ "@anthropic-ai/sdk": "0.115.0", openai: "7.3.0" });
  });

  it("does not let a comment inside a block end it", () => {
    expect(parseWorkspaceCatalogs(WORKSPACE_YAML).bundled?.openai).toBe("7.3.0");
  });

  it("stops a catalog at the next top-level key", () => {
    expect(parseWorkspaceCatalogs(WORKSPACE_YAML).bundled).not.toHaveProperty("postcss@<8.5.18");
  });

  it("parses the repository's real pnpm-workspace.yaml", () => {
    const real = readFileSync(resolve(REPO_ROOT, "pnpm-workspace.yaml"), "utf8");

    const catalogs = parseWorkspaceCatalogs(real);

    expect(Object.keys(catalogs).sort()).toEqual(["bundled", "default"]);
    expect(catalogs.bundled?.openai).toMatch(/^\d+\.\d+\.\d+$/);
    expect(catalogs.default?.zod).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("resolvePublishedDependencies", () => {
  it("resolves catalog, bundled-catalog and literal specifiers to installable versions", () => {
    const resolved = resolvePublishedDependencies(WORKSPACE_YAML, manifests());

    expect(resolved["@verbatra/sdk > openai"]).toBe("7.3.0");
    expect(resolved["@verbatra/sdk > @anthropic-ai/sdk"]).toBe("0.115.0");
    expect(resolved["@verbatra/sdk > zod"]).toBe("4.4.3");
    expect(resolved["@verbatra/sdk > cosmiconfig"]).toBe("9.0.2");
    expect(resolved["@verbatra/cli > commander"]).toBe("15.0.0");
  });

  it("skips workspace dependencies, which no consumer resolves", () => {
    expect(resolvePublishedDependencies(WORKSPACE_YAML, manifests())).not.toHaveProperty(
      "@verbatra/cli > @verbatra/sdk",
    );
  });

  it("omits catalog entries no published package depends on, so a toolchain bump is invisible", () => {
    const resolved = resolvePublishedDependencies(WORKSPACE_YAML, manifests());

    expect(Object.keys(resolved).some((key) => key.endsWith("typescript"))).toBe(false);
    expect(Object.keys(resolved).some((key) => key.endsWith("@types/node"))).toBe(false);
  });

  it("marks a catalog reference with no catalog entry as unresolved rather than throwing", () => {
    const orphan = JSON.stringify({
      name: "@verbatra/sdk",
      dependencies: { "not-in-any-catalog": "catalog:bundled" },
    });

    const resolved = resolvePublishedDependencies(WORKSPACE_YAML, [
      { path: "packages/sdk/package.json", json: orphan },
    ]);

    expect(resolved["@verbatra/sdk > not-in-any-catalog"]).toBe("unresolved");
  });
});

describe("diffResolvedDependencies", () => {
  it("reports a version change", () => {
    const changes = diffResolvedDependencies(
      { "@verbatra/sdk > openai": "6.46.0" },
      { "@verbatra/sdk > openai": "7.3.0" },
    );

    expect(changes).toEqual([
      { package: "@verbatra/sdk", dependency: "openai", from: "6.46.0", to: "7.3.0" },
    ]);
  });

  it("reports an added and a removed dependency", () => {
    const changes = diffResolvedDependencies(
      { "@verbatra/sdk > gone": "1.0.0" },
      { "@verbatra/sdk > fresh": "2.0.0" },
    );

    expect(changes).toEqual([
      { package: "@verbatra/sdk", dependency: "fresh", from: null, to: "2.0.0" },
      { package: "@verbatra/sdk", dependency: "gone", from: "1.0.0", to: null },
    ]);
  });

  it("reports nothing for an identical set", () => {
    const set = { "@verbatra/sdk > openai": "7.3.0", "@verbatra/cli > zod": "4.4.3" };

    expect(diffResolvedDependencies(set, { ...set })).toEqual([]);
  });

  it("catches a bundled catalog bump end to end, since no manifest changes with it", () => {
    const bumped = WORKSPACE_YAML.replace("openai: 7.3.0", "openai: 8.0.0");

    const changes = diffResolvedDependencies(
      resolvePublishedDependencies(WORKSPACE_YAML, manifests()),
      resolvePublishedDependencies(bumped, manifests()),
    );

    expect(changes).toEqual([
      { package: "@verbatra/sdk", dependency: "openai", from: "7.3.0", to: "8.0.0" },
    ]);
  });

  it("ignores a default-catalog bump that reaches no published package", () => {
    const bumped = WORKSPACE_YAML.replace("typescript: 6.0.3", "typescript: 7.0.0");

    const changes = diffResolvedDependencies(
      resolvePublishedDependencies(WORKSPACE_YAML, manifests()),
      resolvePublishedDependencies(bumped, manifests()),
    );

    expect(changes).toEqual([]);
  });
});

describe("parseChangesetPackages", () => {
  it("reads quoted package names out of the frontmatter", () => {
    const changeset = '---\n"@verbatra/cli": patch\n"@verbatra/sdk": minor\n---\n\nA summary.\n';

    expect(parseChangesetPackages(changeset)).toEqual(["@verbatra/cli", "@verbatra/sdk"]);
  });

  it("reads unquoted package names", () => {
    expect(parseChangesetPackages("---\nsome-package: patch\n---\n\nText.\n")).toEqual([
      "some-package",
    ]);
  });

  it("returns nothing for a file with no frontmatter, which is how the README is ignored", () => {
    expect(parseChangesetPackages("# Changesets\n\nHello there.\n")).toEqual([]);
  });

  it("parses the repository's real changeset README as naming no package", () => {
    const readme = readFileSync(resolve(REPO_ROOT, ".changeset/README.md"), "utf8");

    expect(parseChangesetPackages(readme)).toEqual([]);
  });
});

describe("disclosesPublishedPackage", () => {
  const published = ["@verbatra/cli", "@verbatra/sdk", "@verbatra/studio"];

  it("accepts a changeset naming a published package", () => {
    expect(disclosesPublishedPackage(['---\n"@verbatra/sdk": patch\n---\n'], published)).toBe(true);
  });

  it("rejects a changeset naming only a private package", () => {
    expect(disclosesPublishedPackage(['---\n"@verbatra/core": patch\n---\n'], published)).toBe(
      false,
    );
  });

  it("rejects an empty changeset list", () => {
    expect(disclosesPublishedPackage([], published)).toBe(false);
  });
});

describe("isReleaseBranch", () => {
  it("recognizes the Version Packages branch", () => {
    expect(isReleaseBranch("changeset-release/main")).toBe(true);
  });

  it("does not treat an ordinary branch as a release branch", () => {
    expect(isReleaseBranch("fix/something")).toBe(false);
    expect(isReleaseBranch("main")).toBe(false);
    expect(isReleaseBranch(undefined)).toBe(false);
  });

  it("does not match a branch that merely contains the prefix later on", () => {
    expect(isReleaseBranch("feat/changeset-release/main")).toBe(false);
  });
});

describe("evaluate", () => {
  const change = [{ package: "@verbatra/sdk", dependency: "openai", from: "6.46.0", to: "7.3.0" }];
  const disclosure = ['---\n"@verbatra/sdk": patch\n---\n\nBump openai.\n'];

  it("fails a dependency change with no changeset", () => {
    expect(evaluate(change, [], "dependabot/npm_and_yarn/openai-7.3.0")).toEqual({
      ok: false,
      reason: "undisclosed",
    });
  });

  it("passes a dependency change disclosed by a changeset naming a published package", () => {
    expect(evaluate(change, disclosure, "chore/bump-openai")).toEqual({
      ok: true,
      reason: "disclosed",
    });
  });

  it("fails a dependency change whose only changeset names a private package", () => {
    expect(evaluate(change, ['---\n"@verbatra/core": patch\n---\n'], "chore/bump")).toEqual({
      ok: false,
      reason: "undisclosed",
    });
  });

  it("passes when nothing consumer-facing changed", () => {
    expect(evaluate([], [], "chore/tidy")).toEqual({ ok: true, reason: "no-changes" });
  });

  it("exempts the Version Packages branch, which deletes changesets while bumping versions", () => {
    expect(evaluate(change, [], "changeset-release/main")).toEqual({
      ok: true,
      reason: "release-branch",
    });
  });

  it("is not exempted by a bot-shaped branch name, the case the guard exists for", () => {
    for (const branch of [
      "dependabot/npm_and_yarn/openai-7.3.0",
      "dependabot/npm_and_yarn/multi-abc123",
      "renovate/openai-7.x",
    ]) {
      expect(evaluate(change, [], branch).ok).toBe(false);
    }
  });
});
