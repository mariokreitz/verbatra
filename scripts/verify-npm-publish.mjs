#!/usr/bin/env node
// Post-publish recurrence guard. changesets/action reports which packages it *attempted* to
// publish via its `publishedPackages` output, but a green "Version or publish" job does not
// guarantee every package in that list actually landed on the npm registry: `changeset publish`
// can, in principle, publish some packages in a run and silently drop others (a stale local
// npm auth state, a per-package OIDC Trusted Publisher misconfiguration, a transient registry
// error on one `npm publish` call among several) without failing the overall command. That is
// exactly the failure shape that would let @verbatra/cli, a `fixed`-version-locked sibling of
// @verbatra/sdk, fall behind on npm while the workflow keeps reporting success.
//
// This script re-checks changesets/action's own claim against the live registry: for every
// package it says it published, confirm `npm view <name>@<version>` actually resolves. It runs
// in its own read-only `verify-publish` job that needs: the publish job, gated on
// `needs.publish.outputs.published == 'true'`, so it never inherits the publish job's write or
// OIDC scopes even though it depends on that job's outcome.
//
// Usage: PUBLISHED_PACKAGES_JSON='[{"name":"@verbatra/cli","version":"0.5.0"}]' node scripts/verify-npm-publish.mjs

import { execFileSync } from "node:child_process";

// Registry/CDN propagation right after `npm publish` can lag well past a few seconds. This step
// runs once per release and a false failure here blocks a genuinely successful publish and forces
// a manual scramble, so the retry budget is deliberately generous: 12 attempts at 15s apart is 11
// delays, ~165s (2.75 minutes) of total wait before giving up.
const RETRY_ATTEMPTS = 12;
const RETRY_DELAY_MS = 15_000;

/**
 * @typedef {{ name: string; version: string }} PublishedPackage
 */

/**
 * @returns {PublishedPackage[]}
 */
function readPublishedPackages() {
  const raw = process.env.PUBLISHED_PACKAGES_JSON;
  if (!raw || raw.trim() === "") {
    throw new Error("PUBLISHED_PACKAGES_JSON is empty; nothing to verify.");
  }

  /** @type {unknown} */
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`PUBLISHED_PACKAGES_JSON is not valid JSON: ${message}`);
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(
      "changesets/action reported published=true but publishedPackages is empty or not an array; " +
        "the publish step's own output is inconsistent, treat this as a failure.",
    );
  }

  return parsed.map((entry, index) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof (/** @type {Record<string, unknown>} */ (entry).name) !== "string" ||
      typeof (/** @type {Record<string, unknown>} */ (entry).version) !== "string"
    ) {
      throw new Error(
        `publishedPackages[${index}] is missing a string name/version: ${JSON.stringify(entry)}`,
      );
    }
    const record = /** @type {{ name: string; version: string }} */ (entry);
    return { name: record.name, version: record.version };
  });
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

/**
 * Resolve the version npm actually serves for `name@version`, retrying briefly to absorb
 * registry propagation lag right after a publish. Returns the registry version string, or
 * null if the registry never resolves the package/version at all.
 * @param {PublishedPackage} pkg
 * @returns {Promise<string | null>}
 */
async function resolveRegistryVersion(pkg) {
  const spec = `${pkg.name}@${pkg.version}`;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
    try {
      const output = execFileSync("npm", ["view", spec, "version", "--json"], {
        encoding: "utf8",
      }).trim();
      const version = JSON.parse(output);
      if (typeof version === "string" && version === pkg.version) {
        return version;
      }
    } catch {
      // npm view exits non-zero when the version is not found on the registry yet; retry.
    }
    if (attempt < RETRY_ATTEMPTS) {
      await sleep(RETRY_DELAY_MS);
    }
  }
  return null;
}

async function main() {
  const packages = readPublishedPackages();
  console.log(
    `verify-npm-publish: checking ${packages.length} package(s) reported by changesets/action against the npm registry.`,
  );

  /** @type {PublishedPackage[]} */
  const missing = [];
  for (const pkg of packages) {
    process.stdout.write(`  ${pkg.name}@${pkg.version} ... `);
    const resolved = await resolveRegistryVersion(pkg);
    if (resolved === pkg.version) {
      console.log("ok");
    } else {
      console.log("MISSING");
      missing.push(pkg);
    }
  }

  if (missing.length > 0) {
    console.error(
      `verify-npm-publish: ${missing.length} package(s) reported as published by changesets/action ` +
        "did not resolve on the npm registry after retrying:",
    );
    for (const pkg of missing) {
      console.error(`  ${pkg.name}@${pkg.version}`);
    }
    console.error(
      "This means the release workflow reported success while at least one package silently " +
        "failed to publish. Check the OIDC Trusted Publisher configuration for the missing " +
        "package(s) on npmjs.com and the publish step logs for this run.",
    );
    process.exitCode = 1;
    return;
  }

  console.log("verify-npm-publish: all reported packages confirmed on the npm registry.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`verify-npm-publish: ${message}`);
  process.exitCode = 1;
});
