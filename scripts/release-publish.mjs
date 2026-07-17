#!/usr/bin/env node
/**
 * Publish-tag guard: a prerelease can never publish to the latest dist-tag.
 *
 * In pre mode, `changeset publish` resolves the dist-tag per package via getReleaseTag. A
 * package whose registry versions all carry the pre tag's prerelease suffix is classified
 * "only-pre" and is then deliberately published to `latest` instead of the pre tag (upstream
 * policy in @changesets/cli, "because there has not been a regular release of it yet"). That
 * is how @verbatra/studio's prereleases walked onto `latest`. Passing an explicit `--tag`
 * short-circuits that per-package fallback for every package in the run, so this wrapper
 * derives the tag from .changeset/pre.json and forces it whenever pre mode is active.
 *
 * Accepted trade-off, decided in the spec: with the pre tag forced, a brand-new package whose
 * first-ever publish happens during pre mode gets only the pre tag and no `latest` tag, so a
 * bare `npm install <pkg>` will not resolve until its first stable release. Correctness of
 * `latest` outweighs bare-name installability of a prerelease-only package.
 *
 * Invoked as the changesets/action `publish` input: `node scripts/release-publish.mjs`. The
 * child inherits stdio so the action still sees `changeset publish`'s own output, which it
 * parses for publishedPackages and GitHub release creation; do not capture or rewrite that
 * output here.
 *
 * The pure functions are exported for the unit tests; main runs only when the file is invoked
 * as a script, not when it is imported.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Valid npm dist-tag shape. npm dist-tags are plain identifiers; anything else (especially a
 * leading "-") must never reach the publish argv. "next" passes.
 */
const DIST_TAG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Decides the explicit dist-tag for `changeset publish`. Pure (no env or I/O access), so it is
 * unit-tested directly; the caller reads .changeset/pre.json and passes its raw content, or
 * null when the file does not exist.
 *
 * @param {string | null} rawPreJson - raw .changeset/pre.json content, or null when absent
 * @returns {string | null} the tag to force, or null for a plain untagged publish (no pre
 *   mode active, which includes mode "exit")
 * @throws {Error} on any state it cannot positively classify: a malformed pre.json must fail
 *   the publish loudly, never fall through to an untagged publish that would hit the only-pre
 *   fallback
 */
function resolvePublishTag(rawPreJson) {
  if (rawPreJson === null) {
    return null;
  }

  /** @type {unknown} */
  let parsed;
  try {
    parsed = JSON.parse(rawPreJson);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`.changeset/pre.json is not valid JSON: ${message}`);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(".changeset/pre.json does not contain an object; refusing to publish.");
  }

  const { mode, tag } = /** @type {Record<string, unknown>} */ (parsed);
  if (mode !== "pre" && mode !== "exit") {
    throw new Error(
      `.changeset/pre.json has mode ${JSON.stringify(mode)}; expected "pre" or "exit". ` +
        "Refusing to fall through to an untagged publish.",
    );
  }
  if (mode === "exit") {
    return null;
  }

  if (typeof tag !== "string" || !DIST_TAG_PATTERN.test(tag)) {
    throw new Error(
      `.changeset/pre.json has mode "pre" but its tag ${JSON.stringify(tag)} is not a valid ` +
        "npm dist-tag; refusing to publish.",
    );
  }
  return tag;
}

/**
 * Builds the pnpm argv for the publish. Pure, unit-tested. `pnpm exec` runs the changeset bin
 * unambiguously (never a package.json script of the same name).
 * @param {string | null} tag - the dist-tag to force, or null for an untagged publish
 * @returns {string[]}
 */
function buildPublishArgs(tag) {
  const args = ["exec", "changeset", "publish"];
  if (tag !== null) {
    args.push("--tag", tag);
  }
  return args;
}

/**
 * Reads .changeset/pre.json from the repository root.
 * @returns {string | null} the raw file content, or null when the file does not exist
 */
function readPreJson() {
  const preJsonPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".changeset", "pre.json");
  try {
    return readFileSync(preJsonPath, "utf8");
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function main() {
  const tag = resolvePublishTag(readPreJson());
  if (tag === null) {
    console.log("release-publish: no active pre mode, publishing without an explicit --tag.");
  } else {
    console.log(
      `release-publish: pre mode is active, forcing --tag ${tag} for every package in this run.`,
    );
  }

  const args = buildPublishArgs(tag);
  const result = spawnSync("pnpm", args, { stdio: "inherit" });
  if (result.error) {
    throw result.error;
  }
  if (result.status === null) {
    throw new Error(`changeset publish was terminated by signal ${result.signal ?? "unknown"}.`);
  }
  process.exitCode = result.status;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`release-publish: ${message}`);
    process.exitCode = 1;
  }
}

export { buildPublishArgs, resolvePublishTag };
