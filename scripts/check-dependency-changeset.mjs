#!/usr/bin/env node
/**
 * Pull-request guard: a change to what a published package makes consumers install must be
 * accompanied by a changeset, so the move reaches the changelog rather than npm alone.
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
 * reachable from a published manifest are considered, which does mean a default-catalog entry a
 * published package depends on (`zod`, `chokidar`) is gated exactly like a bundled one. That is
 * deliberate: what decides the outcome is whether a consumer resolves it, not which block it sits in.
 *
 * Scope limits worth knowing. Only `dependencies` is read, not `peerDependencies` or
 * `optionalDependencies`, because no published package declares either today. `workspace:` entries
 * are skipped: they name sibling packages whose versions the release flow itself sets and discloses,
 * so requiring a second changeset for them would fail every release.
 *
 * Two exemptions, and the asymmetry between them is deliberate.
 *
 * - By branch, mandatory. The Version Packages head is exempt because that pull request consumes
 *   the changeset files, deleting them in the same diff that bumps versions. The naive rule would
 *   fail every release pull request permanently. Matched exactly against
 *   `changeset-release/<baseBranch>` rather than by prefix, since a head ref is author-controlled
 *   and a prefix would let any branch name its way out of the guard.
 * - By actor, forbidden. Do not add one. Dependabot is the exact case this guard exists for and will
 *   never author a changeset, so exempting it would make the guard a no-op for its only real
 *   trigger.
 *
 * Usage (BASE_SHA defaults to origin/main, so it also runs locally):
 * BASE_SHA=<sha> HEAD_BRANCH=<branch> node scripts/check-dependency-changeset.mjs
 *
 * `HEAD_SHA` is set only by the pull-request job, and only to let the guard recognise GitHub's
 * merge ref. A base passed in `BASE_SHA` is otherwise always used exactly as given.
 *
 * The pure functions are exported for the unit tests; main runs only when the file is invoked as a
 * script, not when it is imported.
 */

import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");

const WORKSPACE_MANIFEST = "pnpm-workspace.yaml";
const CHANGESET_CONFIG = ".changeset/config.json";

/** Workspace package manifests, matching the `packages/*` and `apps/*` globs the workspace declares. */
const WORKSPACE_MANIFEST_PATH = /^(?:packages|apps)\/[^/]+\/package\.json$/;

/**
 * @typedef {{ path: string; json: string }} RawManifest
 */

/**
 * @typedef {{ package: string; dependency: string; from: string | null; to: string | null }} DependencyChange
 */

/** Strips a surrounding pair of double or single quotes from a YAML scalar. */
function unquote(value) {
  const match = /^(?:"(.*)"|'(.*)')$/.exec(value);
  return match ? (match[1] ?? match[2] ?? "") : value;
}

/**
 * Drops an unquoted trailing `#` comment from a YAML scalar and trims the rest. Without this an
 * annotated pin (`openai: 7.3.0 # taken deliberately`) parses as the version `7.3.0 # taken
 * deliberately`, so adding or removing a comment would read as a version change and fail the guard
 * on a comment-only edit. A quoted scalar is returned whole, since a `#` inside quotes is content.
 */
function stripInlineComment(value) {
  const quoted = /^\s*(?:"[^"]*"|'[^']*')/.exec(value);
  if (quoted?.[0] !== undefined) {
    return quoted[0].trim();
  }
  const comment = value.search(/(?:^|\s)#/);
  return (comment === -1 ? value : value.slice(0, comment)).trim();
}

/** The indentation width of a line, counting leading whitespace. */
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
    const value = match?.[2] === undefined ? "" : stripInlineComment(match[2]);
    if (match?.[1] !== undefined && value !== "") {
      entries[unquote(match[1].trim())] = unquote(value);
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
 * the first line past the whole `catalogs:` block. A trailing comment on the catalog's own key line
 * is tolerated: anchoring on a bare `name:` would silently drop the entire catalog the moment
 * someone annotated it, and every dependency in it would then read as removed.
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
    const match = /^\s*(.+?):\s*(?:#.*)?$/.exec(line);
    if (match?.[1] !== undefined) {
      const block = collectMappingBlock(lines, index + 1, indentOf(line));
      target[unquote(match[1].trim())] = block.entries;
      index = block.end - 1;
    }
  }
  return index;
}

/**
 * Resolves one `dependencies` specifier to the version a consumer installs. A `catalog:` reference
 * is looked up in the named catalog (bare `catalog:` means the default one); anything else is
 * already a literal version. `workspace:` entries return null, since the release flow sets and
 * discloses those versions itself.
 *
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
 * The workspace manifests npm publishes: every one not marked `private`. Derived rather than
 * hardcoded, so a newly published package is guarded the day it stops being private and a package
 * moved between `packages/` and `apps/` does not read as having dropped all its dependencies.
 * @param {RawManifest[]} manifests - every workspace manifest at one commit
 * @returns {{ name: string; dependencies: Record<string, string> }[]}
 */
function publishedManifests(manifests) {
  const published = [];
  for (const manifest of manifests) {
    const parsed =
      /** @type {{ name?: string; private?: boolean; dependencies?: Record<string, string> }} */ (
        JSON.parse(manifest.json)
      );
    if (parsed.private === true || typeof parsed.name !== "string") {
      continue;
    }
    published.push({ name: parsed.name, dependencies: parsed.dependencies ?? {} });
  }
  return published;
}

/** The names npm publishes, which a changeset must name to count. */
function publishedNames(manifests) {
  return publishedManifests(manifests).map((manifest) => manifest.name);
}

/**
 * The full set of versions the published packages make consumers install, keyed `package > dep`.
 * This is the value the guard compares across commits, so an entry appearing, disappearing, or
 * changing version is all one uniform difference.
 * @param {string} workspaceYaml - the pnpm-workspace.yaml contents
 * @param {RawManifest[]} manifests - every workspace manifest at the same commit
 * @returns {Record<string, string>}
 */
function resolvePublishedDependencies(workspaceYaml, manifests) {
  const catalogs = parseWorkspaceCatalogs(workspaceYaml);
  /** @type {Record<string, string>} */
  const resolved = {};
  for (const manifest of publishedManifests(manifests)) {
    for (const [dependency, specifier] of Object.entries(manifest.dependencies)) {
      const version = resolveSpecifier(specifier, dependency, catalogs);
      if (version !== null) {
        resolved[`${manifest.name} > ${dependency}`] = version;
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
 * Whether any of the given changeset bodies names a published package. This is a presence check,
 * not a content check: it asserts a changeset accompanies the change, and does not attempt to
 * verify that its prose describes the specific dependency. A changeset naming only a private
 * package cannot appear in a published changelog, so it does not count.
 * @param {string[]} changesetBodies - contents of the changeset files added or updated in the diff
 * @param {readonly string[]} names - the package names published to npm
 * @returns {boolean}
 */
function namesPublishedPackage(changesetBodies, names) {
  return changesetBodies.some((body) =>
    parseChangesetPackages(body).some((name) => names.includes(name)),
  );
}

/**
 * Whether a head branch is the Version Packages branch, which is exempt. Matched exactly rather
 * than by prefix: the head ref is author-controlled, and a prefix match would let any branch named
 * `changeset-release/anything` opt itself out of a required check.
 * @param {string | undefined} branch - the pull request's head branch
 * @param {string} baseBranch - the changesets base branch, from .changeset/config.json
 * @returns {boolean}
 */
function isReleaseBranch(branch, baseBranch) {
  return branch === `changeset-release/${baseBranch}`;
}

/**
 * The guard's verdict. Pure, so every branch is unit-tested without a git repository: no change
 * passes, a change with a qualifying changeset passes, a change without one fails, and the release
 * branch passes regardless.
 * @param {DependencyChange[]} changes - resolved dependency differences
 * @param {string[]} changesetBodies - contents of the changeset files added or updated in the diff
 * @param {{ headBranch?: string | undefined; baseBranch: string; published: readonly string[] }} context
 * @returns {{ ok: boolean; reason: "no-changes" | "release-branch" | "accompanied" | "unaccompanied" }}
 */
function evaluate(changes, changesetBodies, context) {
  if (isReleaseBranch(context.headBranch, context.baseBranch)) {
    return { ok: true, reason: "release-branch" };
  }
  if (changes.length === 0) {
    return { ok: true, reason: "no-changes" };
  }
  return namesPublishedPackage(changesetBodies, context.published)
    ? { ok: true, reason: "accompanied" }
    : { ok: false, reason: "unaccompanied" };
}

/** Runs a git command in the repository root and returns its trimmed stdout. */
function git(args) {
  return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }).trim();
}

/** Whether a ref resolves in this clone. Distinguishes a missing ref from a missing file. */
function refExists(ref) {
  try {
    git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

/** Reads a repository file at a commit, or null when the file does not exist there. */
function readAtCommit(ref, path) {
  try {
    return execFileSync("git", ["show", `${ref}:${path}`], { cwd: REPO_ROOT, encoding: "utf8" });
  } catch {
    return null;
  }
}

/** Every workspace package manifest at a commit, read straight out of the tree. */
function readWorkspaceManifests(ref) {
  const listed = git(["ls-tree", "-r", "--name-only", ref]);
  /** @type {RawManifest[]} */
  const manifests = [];
  for (const path of listed.split("\n")) {
    if (!WORKSPACE_MANIFEST_PATH.test(path)) {
      continue;
    }
    const json = readAtCommit(ref, path);
    if (json !== null) {
      manifests.push({ path, json });
    }
  }
  return manifests;
}

/** The resolved published-dependency set at a commit, or null when the workspace file is absent. */
function resolveAtCommit(ref) {
  const workspaceYaml = readAtCommit(ref, WORKSPACE_MANIFEST);
  if (workspaceYaml === null) {
    return null;
  }
  return resolvePublishedDependencies(workspaceYaml, readWorkspaceManifests(ref));
}

/** Contents of every changeset file the diff adds or updates between `baseRef` and HEAD. */
function readAddedChangesets(baseRef) {
  const listed = git([
    "diff",
    "--name-only",
    "--diff-filter=AM",
    baseRef,
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

/**
 * The commit to compare against.
 *
 * On a `pull_request` event actions/checkout leaves HEAD at the merge ref, whose first parent is by
 * construction the base commit that merge was built on. Using it removes any dependence on the base
 * sha the event payload reported, which can be stale by the time the job runs and would otherwise
 * attribute an unrelated base-branch bump to this pull request.
 *
 * The merge ref is identified by proof, not by shape: HEAD must have two parents AND its second
 * parent must be exactly the pull request's head sha. Testing "HEAD has two parents" alone was a
 * defect, because it silently discarded an explicitly supplied base whenever HEAD happened to be an
 * ordinary merge commit. A branch built the way this repository builds integration branches (feature
 * branches merged back with `--no-ff`) ends at such a commit, and comparing against its first parent
 * hides everything that landed before the final merge. That is the exact failure this guard exists
 * to prevent, so the narrow test matters: given a correct base, the guard must never ignore it.
 *
 * Everywhere else, including a push and any local run, the configured base is used as given.
 *
 * @param configuredBase - The base ref supplied by the caller.
 * @param headSha - The pull request's head sha, when running on a pull request.
 */
function resolveBaseRef(configuredBase, headSha) {
  if (headSha === undefined || headSha === "") {
    return configuredBase;
  }
  const parents = git(["rev-list", "--parents", "-n", "1", "HEAD"]).split(/\s+/);
  return parents.length === 3 && parents[2] === headSha ? "HEAD^1" : configuredBase;
}

/** The changesets base branch, which fixes the exact name of the exempt Version Packages branch. */
function readBaseBranch() {
  const raw = readAtCommit("HEAD", CHANGESET_CONFIG);
  if (raw === null) {
    throw new Error(`HEAD has no ${CHANGESET_CONFIG}; cannot determine the release branch name.`);
  }
  const parsed = /** @type {{ baseBranch?: unknown }} */ (JSON.parse(raw));
  return typeof parsed.baseBranch === "string" ? parsed.baseBranch : "main";
}

/** Reports the unaccompanied changes and what the author has to do about them. */
function reportUnaccompanied(changes) {
  console.error(
    `check-dependency-changeset: ${changes.length} dependency change(s) reach consumers of a ` +
      "published package, and no changeset in this pull request accompanies them:",
  );
  for (const change of changes) {
    const from = change.from ?? "(absent)";
    const to = change.to ?? "(removed)";
    console.error(`  ${change.package} > ${change.dependency}: ${from} -> ${to}`);
  }
  console.error(
    "\nEvery version above lands in a consumer's node_modules, lockfile, npm audit and SBOM, so it " +
      "belongs in the changelog. Run `pnpm changeset`, pick the published package(s) affected, and " +
      "name each dependency above in the summary. A patch bump is right for a routine refresh; a " +
      "bundled major deserves a note on what changed for consumers.",
  );
}

function main() {
  const rawBase = process.env.BASE_SHA?.trim() ?? "";
  // A push that creates a branch reports an all-zero "before" sha, which resolves to nothing.
  const explicitBase = /^0+$/.test(rawBase) ? "" : rawBase;
  const configuredBase = explicitBase || "origin/main";
  const headBranch = process.env.HEAD_BRANCH?.trim();
  const headSha = process.env.HEAD_SHA?.trim();

  if (!refExists(configuredBase)) {
    if (explicitBase) {
      throw new Error(
        `BASE_SHA "${configuredBase}" does not resolve in this clone. The checkout needs ` +
          "fetch-depth: 0 for the guard to see the base commit.",
      );
    }
    console.log(
      `check-dependency-changeset: no "${configuredBase}" in this clone, nothing to compare against.`,
    );
    return;
  }

  const baseRef = resolveBaseRef(configuredBase, headSha);
  const base = resolveAtCommit(baseRef);
  const head = resolveAtCommit("HEAD");
  if (base === null || head === null) {
    throw new Error(`no ${WORKSPACE_MANIFEST} at "${base === null ? baseRef : "HEAD"}".`);
  }

  const changes = diffResolvedDependencies(base, head);
  const verdict = evaluate(changes, readAddedChangesets(baseRef), {
    headBranch,
    baseBranch: readBaseBranch(),
    published: publishedNames(readWorkspaceManifests("HEAD")),
  });

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
      `check-dependency-changeset: ${changes.length} dependency change(s), accompanied by a ` +
        "changeset naming a published package.",
    );
    return;
  }
  reportUnaccompanied(changes);
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
  evaluate,
  isReleaseBranch,
  namesPublishedPackage,
  parseChangesetPackages,
  parseWorkspaceCatalogs,
  publishedNames,
  resolvePublishedDependencies,
  stripInlineComment,
};
