#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");

const WORKSPACE_MANIFEST = "pnpm-workspace.yaml";
const CHANGESET_CONFIG = ".changeset/config.json";

const WORKSPACE_MANIFEST_PATH = /^(?:packages|apps)\/[^/]+\/package\.json$/;

function unquote(value) {
  const match = /^(?:"(.*)"|'(.*)')$/.exec(value);
  return match ? (match[1] ?? match[2] ?? "") : value;
}

function stripInlineComment(value) {
  const quoted = /^\s*(?:"[^"]*"|'[^']*')/.exec(value);
  if (quoted?.[0] !== undefined) {
    return quoted[0].trim();
  }
  const comment = value.search(/(?:^|\s)#/);
  return (comment === -1 ? value : value.slice(0, comment)).trim();
}

function indentOf(line) {
  return line.length - line.trimStart().length;
}

function isBlankOrComment(line) {
  const trimmed = line.trim();
  return trimmed === "" || trimmed.startsWith("#");
}

function collectMappingBlock(lines, start, parentIndent) {
  const entries = {};
  let index = start;
  for (; index < lines.length; index += 1) {
    const line = lines[index];
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

function parseWorkspaceCatalogs(yamlText) {
  const lines = yamlText.split(/\r?\n/);
  const catalogs = {};
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
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

function parseNamedCatalogs(lines, start, target) {
  let index = start;
  for (; index < lines.length; index += 1) {
    const line = lines[index];
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

function publishedManifests(manifests) {
  const published = [];
  for (const manifest of manifests) {
    const parsed = JSON.parse(manifest.json);
    if (parsed.private === true || typeof parsed.name !== "string") {
      continue;
    }
    published.push({ name: parsed.name, dependencies: parsed.dependencies ?? {} });
  }
  return published;
}

function publishedNames(manifests) {
  return publishedManifests(manifests).map((manifest) => manifest.name);
}

function resolvePublishedDependencies(workspaceYaml, manifests) {
  const catalogs = parseWorkspaceCatalogs(workspaceYaml);
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

function diffResolvedDependencies(base, head) {
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

function parseChangesetPackages(markdown) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown.trimStart());
  if (!match?.[1]) {
    return [];
  }
  const names = [];
  for (const line of match[1].split(/\r?\n/)) {
    const entry = /^\s*(.+?):\s*(.+?)\s*$/.exec(line);
    if (entry?.[1] !== undefined) {
      names.push(unquote(entry[1].trim()));
    }
  }
  return names;
}

function namesPublishedPackage(changesetBodies, names) {
  return changesetBodies.some((body) =>
    parseChangesetPackages(body).some((name) => names.includes(name)),
  );
}

function isReleaseBranch(branch, baseBranch) {
  return branch === `changeset-release/${baseBranch}`;
}

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

function git(args) {
  return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }).trim();
}

function refExists(ref) {
  try {
    git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

function readAtCommit(ref, path) {
  try {
    return execFileSync("git", ["show", `${ref}:${path}`], { cwd: REPO_ROOT, encoding: "utf8" });
  } catch {
    return null;
  }
}

function readWorkspaceManifests(ref) {
  const listed = git(["ls-tree", "-r", "--name-only", ref]);
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

function resolveAtCommit(ref) {
  const workspaceYaml = readAtCommit(ref, WORKSPACE_MANIFEST);
  if (workspaceYaml === null) {
    return null;
  }
  return resolvePublishedDependencies(workspaceYaml, readWorkspaceManifests(ref));
}

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

function resolveBaseRef(configuredBase, headSha) {
  if (headSha === undefined || headSha === "") {
    return configuredBase;
  }
  const parents = git(["rev-list", "--parents", "-n", "1", "HEAD"]).split(/\s+/);
  return parents.length === 3 && parents[2] === headSha ? "HEAD^1" : configuredBase;
}

function readBaseBranch() {
  const raw = readAtCommit("HEAD", CHANGESET_CONFIG);
  if (raw === null) {
    throw new Error(`HEAD has no ${CHANGESET_CONFIG}; cannot determine the release branch name.`);
  }
  const parsed = JSON.parse(raw);
  return typeof parsed.baseBranch === "string" ? parsed.baseBranch : "main";
}

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
