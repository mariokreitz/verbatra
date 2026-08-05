/**
 * Keeps the root `verify` script and the CI merge gate from drifting apart.
 *
 * CI deliberately keeps its checks as nine separate steps rather than calling `pnpm verify`: one
 * step per check is what makes `gh run view --json jobs` name the failing check, and collapsing
 * them would trade that attribution for a single opaque red step. The cost of keeping the two
 * definitions separate is that they can diverge, and this test is what pays it. Adding, removing
 * or reordering a gate step in ci.yml fails here until `verify` is updated to match.
 *
 * The parse is scoped to the `build-and-test` job on purpose. The `e2e` and `dependency-disclosure`
 * jobs also run `pnpm` commands, and `e2e` runs `pnpm install --frozen-lockfile` and `pnpm build`
 * of its own, so an unscoped sweep would pull in commands the composite must not contain.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const CI_WORKFLOW = readFileSync(resolve(REPO_ROOT, ".github/workflows/ci.yml"), "utf8");
const ROOT_MANIFEST = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));

/** Indentation width of a line, counting leading spaces only. */
function indentOf(line) {
  return line.length - line.trimStart().length;
}

/** The lines of one top-level job in the workflow, from its key to the next job key. */
function jobBlock(yamlText, jobName) {
  const lines = yamlText.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trimEnd() === `  ${jobName}:`);
  if (start === -1) {
    throw new Error(`job "${jobName}" not found in ci.yml`);
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^ {2}\S/.test(line));
  return end === -1 ? rest : rest.slice(0, end);
}

/** The trimmed body lines of a block scalar starting at `start`, to its first shallower line. */
function blockScalarLines(blockLines, start) {
  const bodyIndent = indentOf(blockLines[start] ?? "");
  const body = [];
  for (let index = start; index < blockLines.length; index += 1) {
    const text = blockLines[index] ?? "";
    if (text.trim() === "") {
      continue;
    }
    if (indentOf(text) < bodyIndent) {
      break;
    }
    body.push(text.trim());
  }
  return body;
}

/** Every shell command a job's steps run, flattening both inline and block `run:` forms. */
function runCommands(blockLines) {
  const commands = [];
  for (let index = 0; index < blockLines.length; index += 1) {
    const line = blockLines[index] ?? "";
    const inline = /^\s*run:\s*([^|\s].*)$/.exec(line);
    if (inline?.[1] !== undefined) {
      commands.push(inline[1].trim());
    } else if (/^\s*run:\s*\|/.test(line)) {
      commands.push(...blockScalarLines(blockLines, index + 1));
    }
  }
  return commands;
}

/**
 * The gate checks among a job's commands: the `pnpm` invocations that verify the tree, as opposed
 * to the environment setup that precedes them (corepack activation, the store path probe, and the
 * dependency install, none of which a contributor with a working checkout needs to repeat).
 */
function gateChecks(commands) {
  return commands.filter(
    (command) =>
      command.startsWith("pnpm ") &&
      !command.startsWith("pnpm install") &&
      !command.includes("store path"),
  );
}

const ciGateChecks = gateChecks(runCommands(jobBlock(CI_WORKFLOW, "build-and-test")));
const verifySteps = String(ROOT_MANIFEST.scripts.verify)
  .split("&&")
  .map((step) => step.trim());

describe("the root verify script mirrors the CI build-and-test job", () => {
  it("runs exactly the same checks, in the same order", () => {
    expect(verifySteps).toEqual(ciGateChecks);
  });

  it("covers the guards that appear nowhere else in the contributor docs", () => {
    for (const guard of [
      "pnpm check:no-em-dash",
      "pnpm check:dts",
      "pnpm check:studio-bundle",
      "pnpm typecheck:configs",
      "pnpm test:scripts",
    ]) {
      expect(verifySteps).toContain(guard);
    }
  });

  /**
   * `pnpm turbo run typecheck` is the one step the loop has to skip: CI invokes turbo directly
   * because no root `typecheck` script exists, and spelling that step `pnpm typecheck` to satisfy
   * the assertion would fail at runtime.
   */
  it("names only scripts the root manifest actually defines", () => {
    for (const step of verifySteps) {
      if (step === "pnpm turbo run typecheck") {
        continue;
      }
      expect(ROOT_MANIFEST.scripts).toHaveProperty(step.replace(/^pnpm /, ""));
    }
  });

  /**
   * check:dts and check:studio-bundle both read `dist/` and exit 1 with "Run the build first", so
   * their position after `pnpm build` is part of the contract rather than incidental ordering.
   */
  it("puts the build before every check that reads build output", () => {
    const buildIndex = verifySteps.indexOf("pnpm build");

    expect(buildIndex).toBeGreaterThanOrEqual(0);
    expect(verifySteps.indexOf("pnpm check:dts")).toBeGreaterThan(buildIndex);
    expect(verifySteps.indexOf("pnpm check:studio-bundle")).toBeGreaterThan(buildIndex);
  });

  it("extracts a non-trivial command list, so the assertions cannot pass vacuously", () => {
    expect(ciGateChecks.length).toBeGreaterThanOrEqual(9);
  });

  /**
   * The e2e job runs a build of its own, which is what makes it a usable canary: if the scoping
   * broke, that build would be pulled into the build-and-test list and surface as a duplicate.
   */
  it("scopes the parse to build-and-test, excluding the other jobs' pnpm commands", () => {
    const e2eChecks = gateChecks(runCommands(jobBlock(CI_WORKFLOW, "e2e")));

    expect(e2eChecks).toContain("pnpm build");
    expect(ciGateChecks.filter((step) => step === "pnpm build")).toHaveLength(1);
  });
});
