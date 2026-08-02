#!/usr/bin/env node
/**
 * Post-publish recurrence guard. changesets/action reports which packages it *attempted* to
 * publish via its `publishedPackages` output, but a green "Version or publish" job does not
 * guarantee every package in that list actually landed on the npm registry: `changeset
 * publish` can, in principle, publish some packages in a run and silently drop others (a
 * stale local npm auth state, a per-package OIDC Trusted Publisher misconfiguration, a
 * transient registry error on one `npm publish` call among several) without failing the
 * overall command. That is exactly the failure shape that would let @verbatra/cli, a
 * `fixed`-version-locked sibling of @verbatra/sdk, fall behind on npm while the workflow
 * keeps reporting success.
 *
 * This script re-checks changesets/action's own claim against the live registry: for every
 * package it says it published, confirm `npm view <name>@<version>` actually resolves. It
 * runs in its own read-only `verify-publish` job that needs: the publish job, gated on
 * `needs.publish.outputs.published == 'true'`, so it never inherits the publish job's write
 * or OIDC scopes even though it depends on that job's outcome.
 *
 * Second check (defense in depth behind scripts/release-publish.mjs): no prerelease published
 * in this run may sit on the registry's `latest` dist-tag. The assertion is pinned to the
 * just-published version, not to registry state at large: @verbatra/studio's `latest` is
 * currently stuck on an older prerelease from before the publish guard existed, its repair is
 * a manual registry operation out of scope here, and a broader "latest must never be a
 * prerelease" assertion would fail every future release until that repair happens. Scoped
 * this way it catches a recurrence without tripping on the pre-existing damage.
 *
 * Third check: every published tarball carries the repository-root LICENSE. No package declares
 * a LICENSE in `files` and no build step copies one in; the text reaches consumers purely
 * because `pnpm pack` injects the workspace-root copy, which `npm pack` does not do. That makes
 * a compliance-relevant property hold by accident, so a change of packer or a package published
 * through some other path would silently ship without a license and nothing would notice. The
 * assertion deliberately reads the *published tarball* rather than the working tree: a
 * working-tree check would pass today while proving nothing about what actually shipped.
 *
 * Usage:
 * PUBLISHED_PACKAGES_JSON='[{"name":"@verbatra/cli","version":"0.5.0"}]' node scripts/verify-npm-publish.mjs
 *
 * The pure functions are exported for the unit tests; main runs only when the file is invoked
 * as a script, not when it is imported.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");

/**
 * Path of the license file inside a published tarball. npm packs every package under a
 * `package/` prefix, so this is the tarball-root LICENSE.
 */
const TARBALL_LICENSE_MEMBER = "package/LICENSE";

/**
 * How many `npm view` attempts to make per package. Registry/CDN propagation right after
 * `npm publish` can lag well past a few seconds. This step runs once per release and a false
 * failure here blocks a genuinely successful publish and forces a manual scramble, so the
 * retry budget is deliberately generous: 12 attempts at 15s apart is 11 delays, ~165s
 * (2.75 minutes) of total wait before giving up.
 */
const RETRY_ATTEMPTS = 12;

/** Delay between registry lookup attempts, in milliseconds. */
const RETRY_DELAY_MS = 15_000;

/**
 * @typedef {{ name: string; version: string }} PublishedPackage
 */

/**
 * @typedef {{ pkg: PublishedPackage; problem: "missing" | "mismatched" }} LicenseFinding
 */

/**
 * Parses and validates the publishedPackages payload. Pure (no env or I/O access), so it is
 * unit-tested directly rather than through the environment variable.
 * @param {string | undefined} raw - the PUBLISHED_PACKAGES_JSON value
 * @returns {PublishedPackage[]}
 * @throws {Error} when the payload is empty, not valid JSON, not a non-empty array, or an
 *   entry lacks a string name or version
 */
function parsePublishedPackages(raw) {
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
 * Semver shape check: major.minor.patch, optional prerelease component, optional build
 * metadata. Slightly looser than SemVer 2.0.0 (leading zeros pass), which is immaterial for
 * changesets-produced versions. Group 1 is the prerelease component when present.
 */
const SEMVER_PATTERN =
  /^\d+\.\d+\.\d+(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

/**
 * Whether a version carries a semver prerelease component. Pure, unit-tested. Versions here
 * come from changesets' own output, so anything that is not valid semver is a corrupted
 * payload and fails loudly rather than being silently classified as stable.
 * @param {string} version - the version to classify
 * @returns {boolean}
 * @throws {Error} when the version is not valid semver
 */
function isPrereleaseVersion(version) {
  const match = SEMVER_PATTERN.exec(version);
  if (!match) {
    throw new Error(
      `"${version}" is not valid semver; cannot classify it as prerelease or stable.`,
    );
  }
  return match[1] !== undefined;
}

/**
 * Whether a just-published version has taken over the `latest` dist-tag it must never hold.
 * Pure, unit-tested. Pinned to the just-published version: an older prerelease stuck on
 * `latest` from before the guard existed is not this run's violation and must not trip it.
 * @param {string} publishedVersion - the version published in this run
 * @param {string | null} latestVersion - registry dist-tags.latest, or null when the tag is
 *   absent
 * @returns {boolean}
 */
function isLatestTagViolation(publishedVersion, latestVersion) {
  return isPrereleaseVersion(publishedVersion) && latestVersion === publishedVersion;
}

/**
 * Reads and parses the PUBLISHED_PACKAGES_JSON environment variable.
 * @returns {PublishedPackage[]}
 */
function readPublishedPackages() {
  return parsePublishedPackages(process.env.PUBLISHED_PACKAGES_JSON);
}

/**
 * Waits for the given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

/**
 * Resolves the version npm actually serves for `name@version`, retrying to absorb registry
 * propagation lag right after a publish. `npm view` exits non-zero while the version is not
 * yet on the registry; that counts as not-found-yet and triggers the next attempt.
 * @param {PublishedPackage} pkg
 * @returns {Promise<string | null>} the registry version string, or null if the registry
 *   never resolves the package/version within the retry budget
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
    } catch {}
    if (attempt < RETRY_ATTEMPTS) {
      await sleep(RETRY_DELAY_MS);
    }
  }
  return null;
}

/**
 * Reads the registry's `latest` dist-tag for a package. Single read, no retry: it runs only
 * after resolveRegistryVersion confirmed the packument already serves the just-published
 * version. This is a separate registry request that can hit a different CDN edge; a stale
 * read can only produce a false pass, accepted as defense in depth behind the
 * release-publish.mjs prevention guard. `npm view` exiting non-zero (a missing tag on some
 * registry responses, or a transient registry error) reads as "no violation" for the same
 * reason: a false failure here would block a good release.
 * @param {string} name - the package name
 * @returns {string | null} the version `latest` points at, or null when the tag does not
 *   exist, which is the expected state for a package that has only ever published prereleases
 *   behind the release-publish.mjs tag guard
 */
function readLatestDistTag(name) {
  try {
    const output = execFileSync("npm", ["view", name, "dist-tags.latest", "--json"], {
      encoding: "utf8",
    }).trim();
    if (output === "") {
      return null;
    }
    const latest = JSON.parse(output);
    return typeof latest === "string" ? latest : null;
  } catch {
    return null;
  }
}

/**
 * Whether a just-published package is a prerelease now sitting on the registry's `latest`
 * dist-tag. Thin I/O shell over the pure classification and comparison functions.
 * @param {PublishedPackage} pkg
 * @returns {boolean}
 */
function tookOverLatestTag(pkg) {
  if (!isPrereleaseVersion(pkg.version)) {
    return false;
  }
  return isLatestTagViolation(pkg.version, readLatestDistTag(pkg.name));
}

/**
 * Normalizes license text for comparison: folds CRLF to LF and trims surrounding whitespace, so
 * a tarball packed on a different platform is not reported as carrying a different license.
 * Pure, unit-tested.
 * @param {string} text - the license text to normalize
 * @returns {string}
 */
function normalizeLicenseText(text) {
  return text.replace(/\r\n/g, "\n").trim();
}

/**
 * Classifies a published tarball's LICENSE against the repository-root LICENSE. Pure and
 * unit-tested including the absent case, so the assertion is proven to actually fail rather
 * than being exercised only through the registry path, where every real tarball passes today.
 *
 * Content is compared, not just presence, so a truncated or wrong-holder copy is caught too.
 * @param {string | null} tarballLicense - the tarball's LICENSE text, or null when the tarball
 *   carries no root LICENSE
 * @param {string} rootLicense - the repository-root LICENSE text
 * @returns {"missing" | "mismatched" | null} the problem, or null when the license is correct
 */
function classifyLicense(tarballLicense, rootLicense) {
  if (tarballLicense === null) {
    return "missing";
  }
  return normalizeLicenseText(tarballLicense) === normalizeLicenseText(rootLicense)
    ? null
    : "mismatched";
}

/**
 * Extracts the root LICENSE from a package's published tarball. Downloads the tarball with
 * `npm pack` into a fresh empty directory, so the archive is identified by being that
 * directory's only entry rather than by reconstructing npm's filename scheme, then reads the
 * member out with `tar`. The temporary directory is always removed.
 *
 * A non-zero `tar` exit is read as "no root LICENSE". A corrupt archive would also land here and
 * be reported as missing rather than as a distinct failure; both are loud failures pointing at
 * the same tarball, so the distinction would buy nothing.
 * @param {PublishedPackage} pkg - the package whose published tarball to inspect
 * @returns {string | null} the LICENSE text, or null when the tarball has no root LICENSE
 * @throws {Error} when the published tarball cannot be downloaded
 */
function readPublishedLicense(pkg) {
  const spec = `${pkg.name}@${pkg.version}`;
  const workDir = mkdtempSync(join(tmpdir(), "verbatra-license-"));
  try {
    try {
      execFileSync("npm", ["pack", spec, "--pack-destination", workDir, "--silent"], {
        encoding: "utf8",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`could not download the published tarball for ${spec}: ${message}`);
    }
    const tarball = readdirSync(workDir)[0];
    if (tarball === undefined) {
      throw new Error(`npm pack produced no tarball for ${spec}.`);
    }
    try {
      return execFileSync("tar", ["-xzOf", join(workDir, tarball), TARBALL_LICENSE_MEMBER], {
        encoding: "utf8",
      });
    } catch {
      return null;
    }
  } finally {
    rmSync(workDir, { force: true, recursive: true });
  }
}

/**
 * Reports packages whose published tarball is missing the root LICENSE or carries different
 * text.
 * @param {LicenseFinding[]} findings
 */
function reportLicenseFindings(findings) {
  console.error(
    `verify-npm-publish: ${findings.length} package(s) published in this run do not carry the ` +
      "repository-root LICENSE in their registry tarball:",
  );
  for (const finding of findings) {
    const detail =
      finding.problem === "missing"
        ? "no package/LICENSE in the tarball"
        : "package/LICENSE differs from the repository root LICENSE";
    console.error(`  ${finding.pkg.name}@${finding.pkg.version} (${detail})`);
  }
  console.error(
    "The published LICENSE is injected by `pnpm pack` from the workspace root, so this usually " +
      "means the release ran through a different packer (`npm pack` does not inject it) or the " +
      "root LICENSE changed. Republishing is the only fix; a published tarball cannot be " +
      "amended in place.",
  );
}

/**
 * Reports packages that never resolved on the registry.
 * @param {PublishedPackage[]} missing
 */
function reportMissing(missing) {
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
}

/**
 * Reports just-published prereleases that took over the `latest` dist-tag.
 * @param {PublishedPackage[]} violations
 */
function reportLatestTagViolations(violations) {
  console.error(
    `verify-npm-publish: ${violations.length} prerelease package(s) published in this run took ` +
      "over the latest dist-tag:",
  );
  for (const pkg of violations) {
    console.error(`  ${pkg.name}@${pkg.version} (dist-tags.latest points at it)`);
  }
  console.error(
    "The publish guard (scripts/release-publish.mjs) should have forced the pre tag; check " +
      "the publish step logs for this run and repair the dist-tag on npmjs.com with " +
      "`npm dist-tag add`. This assertion is pinned to the just-published version, so a " +
      "stale latest tag from before the guard does not trip it.",
  );
}

async function main() {
  const packages = readPublishedPackages();
  const rootLicense = readFileSync(resolve(REPO_ROOT, "LICENSE"), "utf8");
  console.log(
    `verify-npm-publish: checking ${packages.length} package(s) reported by changesets/action against the npm registry.`,
  );

  /** @type {PublishedPackage[]} */
  const missing = [];
  /** @type {PublishedPackage[]} */
  const latestTagViolations = [];
  /** @type {LicenseFinding[]} */
  const licenseFindings = [];
  for (const pkg of packages) {
    process.stdout.write(`  ${pkg.name}@${pkg.version} ... `);
    const resolved = await resolveRegistryVersion(pkg);
    if (resolved !== pkg.version) {
      console.log("MISSING");
      missing.push(pkg);
      continue;
    }
    console.log("ok");
    if (tookOverLatestTag(pkg)) {
      console.log(`    dist-tags.latest is ${pkg.version}: the prerelease just published.`);
      latestTagViolations.push(pkg);
    }
    const problem = classifyLicense(readPublishedLicense(pkg), rootLicense);
    if (problem !== null) {
      console.log(`    LICENSE ${problem}.`);
      licenseFindings.push({ pkg, problem });
    }
  }

  if (missing.length > 0) {
    reportMissing(missing);
    process.exitCode = 1;
  }
  if (latestTagViolations.length > 0) {
    reportLatestTagViolations(latestTagViolations);
    process.exitCode = 1;
  }
  if (licenseFindings.length > 0) {
    reportLicenseFindings(licenseFindings);
    process.exitCode = 1;
  }
  if (missing.length === 0 && latestTagViolations.length === 0 && licenseFindings.length === 0) {
    console.log(
      "verify-npm-publish: all reported packages confirmed on the npm registry, no prerelease " +
        "took over the latest dist-tag, every tarball carries the root LICENSE.",
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`verify-npm-publish: ${message}`);
    process.exitCode = 1;
  });
}

export {
  classifyLicense,
  isLatestTagViolation,
  isPrereleaseVersion,
  normalizeLicenseText,
  parsePublishedPackages,
};
