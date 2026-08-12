/**
 * Keeps the root `test:scripts` task scoped to the `scripts/` directory rather than to every path
 * that happens to contain the word.
 *
 * There is no root vitest config, so a bare positional argument such as `vitest run scripts` is a
 * path SUBSTRING filter applied to a scan of the whole working tree, not a directory scope. Every
 * test file whose path contains `scripts` anywhere is selected: `apps/docs/scripts/`, a
 * `scripts-runner.test.ts` inside a package, or a stray git worktree checked out below the repo
 * root. The failure is over-inclusion, so a clean CI checkout hides it and only a local tree with
 * extra directories shows it, which is what makes it worth pinning here.
 *
 * The guard derives the arguments from the manifest instead of asserting a literal string, so a
 * revert to the substring form fails rather than merely reading differently. It runs them against a
 * throwaway fixture tree that holds one file under `scripts/` and two decoys whose paths contain
 * the substring, and asserts the selection is exactly the first. The fixture is a temporary
 * directory: a decoy `*.test.*` file committed into the repository would be the very problem being
 * guarded against.
 *
 * The guard assumes command-line scoping. If the task ever moves to a root vitest config with an
 * explicit `include`, the fixture will not inherit it and this test has to be reworked to match.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VITEST_BIN = resolve(REPO_ROOT, "node_modules/.bin/vitest");

const ROOT_MANIFEST = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));

/** The file the task is meant to select, and the decoys it must not, all relative to the fixture. */
const INTENDED_FILE = "scripts/gate.test.mjs";
const DECOY_FILES = ["packages/cli/src/scripts-runner.test.mjs", "docs-scripts/build.test.mjs"];

/**
 * The `test:scripts` arguments, rewritten from a run into a file listing.
 *
 * Dropping the leading `vitest run` and keeping everything after it is what carries the real
 * scoping flags into the fixture, so the assertion below tests the configured task rather than a
 * copy of it that can drift.
 */
function listArgumentsFromTask() {
  const task = String(ROOT_MANIFEST.scripts["test:scripts"]).trim();
  const tokens = task.split(/\s+/);

  if (tokens[0] !== "vitest" || tokens[1] !== "run") {
    throw new Error(
      `test:scripts no longer starts with "vitest run" (found "${task}"); update this guard to match the new form`,
    );
  }
  return ["list", "--filesOnly", ...tokens.slice(2)];
}

/** A throwaway tree holding the intended file plus decoy paths that contain the substring. */
function createFixtureTree() {
  const root = mkdtempSync(join(realpathSync(tmpdir()), "verbatra-scripts-scope-"));

  writeFileSync(join(root, "package.json"), '{"name":"fixture","private":true,"type":"module"}\n');
  for (const relativePath of [INTENDED_FILE, ...DECOY_FILES]) {
    const absolutePath = join(root, relativePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, "// fixture placeholder, never executed\n");
  }
  return root;
}

/** The fixture-relative test files the task selects, sorted for a stable comparison. */
function selectTestFiles(fixtureRoot) {
  const result = spawnSync(VITEST_BIN, listArgumentsFromTask(), {
    cwd: fixtureRoot,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(`vitest list failed (${result.status}): ${result.stderr}`);
  }
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.endsWith(".test.mjs"))
    .sort();
}

describe("the root test:scripts task scopes to the scripts directory", () => {
  let fixtureRoot = "";
  let selectedFiles = [];

  beforeAll(() => {
    fixtureRoot = createFixtureTree();
    selectedFiles = selectTestFiles(fixtureRoot);
  }, 60_000);

  afterAll(() => {
    if (fixtureRoot !== "") {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("selects exactly the files under scripts, and no path that merely contains the word", () => {
    expect(selectedFiles).toEqual([INTENDED_FILE]);
  });
});
