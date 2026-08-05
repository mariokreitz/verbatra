#!/usr/bin/env node
/**
 * Pull-request guard: a change to what a published package makes consumers install must ship with a
 * changeset, so the move is disclosed in the changelog rather than reaching npm silently.
 *
 * This exists because four consumer-visible dependency deltas shipped inside `@verbatra/sdk@0.6.3`
 * with no changeset and no changelog line, among them an `openai` major. Nothing in the pipeline
 * could have caught it: neither `ci.yml` nor `lefthook.yml` checks for changeset presence, and the
 * only control was an advisory checkbox in the pull-request template, which a bot never ticks.
 *
 * What counts as consumer-visible is computed rather than pattern-matched. For every published
 * package the guard resolves each `dependencies` entry to the version a consumer would install,
 * following `catalog:` and `catalog:bundled` references into pnpm-workspace.yaml, and compares that
 * resolved set between the base commit and HEAD. Resolving rather than diffing the YAML text is what
 * makes the check honest in both directions: a `catalogs.bundled` bump changes no package.json at
 * all (the manifests hold `catalog:bundled`, not a version), while a default-catalog bump of
 * typescript or vitest reaches no consumer and must not fail a pull request. Only entries actually
 * reachable from a published manifest are considered.
 *
 * `workspace:` entries are skipped. They name internal packages that tsup bundles into the tarball,
 * so their specifier is not something a consumer resolves.
 *
 * Two exemptions, and the asymmetry between them is deliberate.
 *
 * - By branch, mandatory. A `changeset-release/*` head is exempt because the Version Packages pull
 *   request consumes the changeset files, deleting them in the same diff that bumps versions. The
 *   naive rule would fail every release pull request permanently.
 * - By actor, forbidden. Do not add one. Dependabot is the exact case this guard exists for and will
 *   never author a changeset, so exempting it would make the guard a no-op for its only real
 *   trigger.
 *
 * Usage (BASE_SHA defaults to origin/main, so it also runs locally):
 * BASE_SHA=<sha> HEAD_BRANCH=<branch> node scripts/check-dependency-changeset.mjs
 *
 * The pure functions are exported for the unit tests; main runs only when the file is invoked as a
 * script, not when it is imported.
 */

import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");

/** Manifests of the packages published to npm, repository-relative. Private packages are excluded. */
const PUBLISHED_MANIFESTS = [
  "packages/cli/package.json",
  "packages/sdk/package.json",
  "packages/studio/package.json",
];

/** The names those manifests publish under, which a changeset must name to disclose a change. */
const PUBLISHED_NAMES = ["@verbatra/cli", "@verbatra/sdk", "@verbatra/studio"];

const WORKSPACE_MANIFEST = "pnpm-workspace.yaml";

/** Head branches exempt from the guard, matched as a prefix. See the module note on exemptions. */
const RELEASE_BRANCH_PREFIX = "changeset-release/";

/**
 * @typedef {{ catalogs: Record<string, Record<string, string>> }} WorkspaceCatalogs
 */

/**
 * @typedef {{ package: string; dependency: string; from: string | null; to: string | null }} DependencyChange
 */

/** Strips a surrounding pair of double or single quotes from a YAML scalar. */
function unquote(value) {
  const match = /^(?:"(.*)"|'(.*)')$/.exec(value);
  return match ? (match[1] ?? match[2] ?? "") : value;
}

/** The indentation width of a line, counting leading spaces only. */
function indentOf(line) {
  return line.length - line.trimStart().length;
}

/** Whether a line carries no YAML content: blank, or a comment. */
function isBlankOrComment(line) {
  const trimmed = line.trim();
  return trimmed === "" || trimmed.startsWith("#");
}

/**
 * Collects the `key: value` pairs of one YAML mapping block: every content line indented deeper than
 * `parentIndent`, stopping at the first content line that is not. Blank and comment lines never end
 * a block, so a comment between entries is transparent.
 * @param {string[]} lines - all lines of the document
 * @param {number} start - index of the first line after the block's own key
 * @param {number} parentIndent - indentation of the key that opened the block
 * @returns {{ entries: Record<string, string>; end: number }}
 */
function collectMappingBlock(lines, start, parentIndent) {
  /** @type {Record<string, string>} */
  const entries = {};
  let index = start;
  for (; index < lines.length; index += 1) {
    const line = /** @type {string} */ (lines[index]);
    if (isBlankOrComment(line)) {
      continue;
    }
    if (indentOf(line) <= parentIndent) {
      break;
    }
    const match = /^\s*(.+?):\s*(.*)$/.exec(line);
    if (match?.[1] !== undefined && match[2] !== undefined && match[2] !== "") {
      entries[unquote(match[1])] = unquote(match[2]);
    }
  }
  return { entries, end: index };
}

/**
 * Parses the catalogs a pnpm-workspace.yaml declares into `{ catalogName: { dependency: version } }`.
 * The default `catalog:` block is keyed as "default", matching how a bare `catalog:` specifier
 * resolves. Line-based on purpose: the repository takes no YAML dependency for its guard scripts,
 * and the two blocks this reads are flat maps of scalars.
 * @param {string} yamlText - the pnpm-workspace.yaml contents
 * @returns {Record<string, Record<string, string>>}
 */
function parseWorkspaceCatalogs(yamlText) {
  const lines = yamlText.split(/\r?\n/);
  /** @type {Record<string, Record<string, string>>} */
  const catalogs = {};
  for (let index = 0; index < lines.length; index += 1) {
    const line = /** @type {string} */ (lines[index]);
    if (isBlankOrComment(line) || indentOf(line) !== 0) {
      continue;
    }
    if (line.startsWith("catalog:")) {
      const block = collectMappingBlock(lines, index + 1, 0);
      catalogs.default = block.entries;
      index = block.end - 1;
    } else if (line.startsWith("catalogs:")) {
      index = parseNamedCatalogs(lines, index + 1, catalogs) - 1;
    }
  }
  return catalogs;
}

/**
 * Parses the named catalogs nested under a `catalogs:` key into `target`, and returns the index of
 * the first line past the whole `catalogs:` block.
 * @param {string[]} lines - all lines of the document
 * @param {number} start - index of the first line after `catalogs:`
 * @param {Record<string, Record<string, string>>} target - accumulator, keyed by catalog name
 * @returns {number}
 */
function parseNamedCatalogs(lines, start, target) {
  let index = start;
  for (; index < lines.length; index += 1) {
    const line = /** @type {string} */ (lines[index]);
    if (isBlankOrComment(line)) {
      continue;
    }
    if (indentOf(line) === 0) {
      break;
    }
    const match = /^\s*(.+?):\s*$/.exec(line);
    if (match?.[1] !== undefined) {
      const block = collectMappingBlock(lines, index + 1, indentOf(line));
      target[unquote(match[1])] = block.entries;
      index = block.end - 1;
    }
  }
  return index;
}

/**
 * Resolves one `dependencies` specifier to the version a consumer installs. A `catalog:` reference
 * is looked up in the named catalog (bare `catalog:` means the default one); anything else is
 * already a literal version. `workspace:` entries return null: they name internal packages bundled
 * into the tarball, so no consumer resolves their specifier.
 * An unresolvable catalog reference yields the sentinel "unresolved" rather than throwing: it is a
 * broken workspace, and reporting it as a difference is more useful than failing the guard itself.
 * @param {string} specifier - the raw value from a `dependencies` entry
 * @param {string} dependency - the dependency name, used to look the reference up in the catalog
 * @param {Record<string, Record<string, string>>} catalogs - parsed workspace catalogs
 * @returns {string | null} the resolved version, or null when the entry is not consumer-facing
 */
function resolveSpecifier(specifier, dependency, catalogs) {
  if (specifier.startsWith("workspace:")) {
    return null;
  }
  if (!specifier.startsWith("catalog:")) {
    return specifier;
  }
  const catalogName = specifier.slice("catalog:".length).trim() || "default";
  return catalogs[catalogName]?.[dependency] ?? "unresolved";
}

/**
 * The full set of versions the published packages make consumers install, keyed `package > dep`.
 * This is the value the guard compares across commits, so an entry appearing, disappearing, or
 * changing version is all one uniform difference.
 * @param {string} workspaceYaml - the pnpm-workspace.yaml contents
 * @param {{ path: string; json: string }[]} manifests - the published package manifests
 * @returns {Record<string, string>}
 */
function resolvePublishedDependencies(workspaceYaml, manifests) {
  const catalogs = parseWorkspaceCatalogs(workspaceYaml);
  /** @type {Record<string, string>} */
  const resolved = {};
  for (const manifest of manifests) {
    const parsed = /** @type {{ name?: string; dependencies?: Record<string, string> }} */ (
      JSON.parse(manifest.json)
    );
    const name = parsed.name ?? manifest.path;
    for (const [dependency, specifier] of Object.entries(parsed.dependencies ?? {})) {
      const version = resolveSpecifier(specifier, dependency, catalogs);
      if (version !== null) {
        resolved[`${name} > ${dependency}`] = version;
      }
    }
  }
  return resolved;
}

/**
 * Differences between two resolved dependency sets, as one entry per added, removed, or changed
 * dependency. Pure and unit-tested, since this is the assertion the whole guard rests on.
 * @param {Record<string, string>} base - resolved set at the base commit
 * @param {Record<string, string>} head - resolved set at HEAD
 * @returns {DependencyChange[]}
 */
function diffResolvedDependencies(base, head) {
  /** @type {DependencyChange[]} */
  const changes = [];
  for (const key of new Set([...Object.keys(base), ...Object.keys(head)])) {
    const from = base[key] ?? null;
    const to = head[key] ?? null;
    if (from === to) {
      continue;
    }
    const [pkg = key, dependency = key] = key.split(" > ");
    changes.push({ package: pkg, dependency, from, to });
  }
  return changes.sort((a, b) => a.dependency.localeCompare(b.dependency));
}

/**
 * The package names a changeset's frontmatter names. Returns an empty list for a file with no
 * frontmatter, which is how `.changeset/README.md` is ignored without special-casing its name.
 * @param {string} markdown - the changeset file contents
 * @returns {string[]}
 */
function parseChangesetPackages(markdown) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown.trimStart());
  if (!match?.[1]) {
    return [];
  }
  /** @type {string[]} */
  const names = [];
  for (const line of match[1].split(/\r?\n/)) {
    const entry = /^\s*(.+?):\s*(.+?)\s*$/.exec(line);
    if (entry?.[1] !== undefined) {
      names.push(unquote(entry[1].trim()));
    }
  }
  return names;
}

/**
 * Whether any of the given changeset bodies discloses a change to a published package. A changeset
 * naming only a private package cannot appear in a published changelog, so it does not count.
 * @param {string[]} changesetBodies - contents of the changeset files added or updated in the diff
 * @param {readonly string[]} publishedNames - the package names published to npm
 * @returns {boolean}
 */
function disclosesPublishedPackage(changesetBodies, publishedNames) {
  return changesetBodies.some((body) =>
    parseChangesetPackages(body).some((name) => publishedNames.includes(name)),
  );
}

/**
 * Whether a head branch is the Version Packages branch, which is exempt. Matched as a prefix, the
 * shape changesets/action creates.
 * @param {string | undefined} branch - the pull request's head branch
 * @returns {boolean}
 */
function isReleaseBranch(branch) {
  return typeof branch === "string" && branch.startsWith(RELEASE_BRANCH_PREFIX);
}

/**
 * The guard's verdict. Pure, so every branch is unit-tested without a git repository: no change
 * passes, a change with a qualifying changeset passes, a change without one fails, and a release
 * branch passes regardless.
 * @param {DependencyChange[]} changes - resolved dependency differences
 * @param {string[]} changesetBodies - contents of the changeset files added or updated in the diff
 * @param {string | undefined} headBranch - the pull request's head branch
 * @returns {{ ok: boolean; reason: "no-changes" | "release-branch" | "disclosed" | "undisclosed" }}
 */
function evaluate(changes, changesetBodies, headBranch) {
  if (isReleaseBranch(headBranch)) {
    return { ok: true, reason: "release-branch" };
  }
  if (changes.length === 0) {
    return { ok: true, reason: "no-changes" };
  }
  return disclosesPublishedPackage(changesetBodies, PUBLISHED_NAMES)
    ? { ok: true, reason: "disclosed" }
    : { ok: false, reason: "undisclosed" };
}

/** Runs a git command in the repository root and returns its trimmed stdout. */
function git(args) {
  return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }).trim();
}

/** Reads a repository file at a commit, or null when the file does not exist there. */
function readAtCommit(ref, path) {
  try {
    return execFileSync("git", ["show", `${ref}:${path}`], { cwd: REPO_ROOT, encoding: "utf8" });
  } catch {
    return null;
  }
}

/** The resolved published-dependency set at a commit, or null when the workspace file is absent. */
function resolveAtCommit(ref) {
  const workspaceYaml = readAtCommit(ref, WORKSPACE_MANIFEST);
  if (workspaceYaml === null) {
    return null;
  }
  const manifests = [];
  for (const path of PUBLISHED_MANIFESTS) {
    const json = readAtCommit(ref, path);
    if (json !== null) {
      manifests.push({ path, json });
    }
  }
  return resolvePublishedDependencies(workspaceYaml, manifests);
}

/** Contents of every changeset file the diff adds or updates between `baseSha` and HEAD. */
function readAddedChangesets(baseSha) {
  const listed = git([
    "diff",
    "--name-only",
    "--diff-filter=AM",
    baseSha,
    "HEAD",
    "--",
    ".changeset",
  ]);
  return listed
    .split("\n")
    .filter((path) => path.endsWith(".md"))
    .map((path) => readAtCommit("HEAD", path))
    .filter((body) => body !== null);
}

/** Reports the undisclosed changes and what the author has to do about them. */
function reportUndisclosed(changes) {
  console.error(
    `check-dependency-changeset: ${changes.length} dependency change(s) reach consumers of a ` +
      "published package, and no changeset in this pull request discloses them:",
  );
  for (const change of changes) {
    const from = change.from ?? "(absent)";
    const to = change.to ?? "(removed)";
    console.error(`  ${change.package} > ${change.dependency}: ${from} -> ${to}`);
  }
  console.error(
    "\nEvery version above lands in a consumer's node_modules, lockfile, npm audit and SBOM, so it " +
      "belongs in the changelog. Run `pnpm changeset`, pick the published package(s) affected, and " +
      "describe the move. A patch bump is right for a routine refresh; a bundled major deserves a " +
      "note on what changed for consumers.",
  );
}

function main() {
  const baseSha = process.env.BASE_SHA?.trim() || "origin/main";
  const headBranch = process.env.HEAD_BRANCH?.trim();

  const base = resolveAtCommit(baseSha);
  if (base === null) {
    console.log(
      `check-dependency-changeset: no ${WORKSPACE_MANIFEST} at "${baseSha}", nothing to compare.`,
    );
    return;
  }
  const head = resolveAtCommit("HEAD");
  if (head === null) {
    throw new Error(`HEAD has no ${WORKSPACE_MANIFEST}; the working tree is not this repository.`);
  }

  const changes = diffResolvedDependencies(base, head);
  const verdict = evaluate(changes, readAddedChangesets(baseSha), headBranch);

  if (verdict.reason === "release-branch") {
    console.log(
      `check-dependency-changeset: "${headBranch}" is the Version Packages branch, which consumes ` +
        "changeset files rather than adding them. Exempt.",
    );
    return;
  }
  if (verdict.reason === "no-changes") {
    console.log(
      "check-dependency-changeset: no published package's resolved dependencies changed.",
    );
    return;
  }
  if (verdict.ok) {
    console.log(
      `check-dependency-changeset: ${changes.length} dependency change(s), disclosed by a changeset ` +
        "naming a published package.",
    );
    return;
  }
  reportUndisclosed(changes);
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`check-dependency-changeset: ${message}`);
    process.exitCode = 1;
  }
}

export {
  diffResolvedDependencies,
  disclosesPublishedPackage,
  evaluate,
  isReleaseBranch,
  parseChangesetPackages,
  parseWorkspaceCatalogs,
  resolvePublishedDependencies,
};
