import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VITEST_BIN = resolve(REPO_ROOT, "node_modules/.bin/vitest");

const ROOT_MANIFEST = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));

const INTENDED_FILE = "scripts/gate.test.mjs";
const DECOY_FILES = ["packages/cli/src/scripts-runner.test.mjs", "docs-scripts/build.test.mjs"];

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
