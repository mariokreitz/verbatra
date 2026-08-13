#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");

const TARBALL_LICENSE_MEMBER = "package/LICENSE";

function parsePublishedPackages(raw) {
  if (!raw || raw.trim() === "") {
    throw new Error("PUBLISHED_PACKAGES_JSON is empty; nothing to verify.");
  }

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
      typeof entry.name !== "string" ||
      typeof entry.version !== "string"
    ) {
      throw new Error(
        `publishedPackages[${index}] is missing a string name/version: ${JSON.stringify(entry)}`,
      );
    }
    return { name: entry.name, version: entry.version };
  });
}

const SEMVER_PATTERN =
  /^\d+\.\d+\.\d+(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function isPrereleaseVersion(version) {
  const match = SEMVER_PATTERN.exec(version);
  if (!match) {
    throw new Error(
      `"${version}" is not valid semver; cannot classify it as prerelease or stable.`,
    );
  }
  return match[1] !== undefined;
}

function isLatestTagViolation(publishedVersion, latestVersion) {
  return isPrereleaseVersion(publishedVersion) && latestVersion === publishedVersion;
}

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

function tookOverLatestTag(pkg) {
  if (!isPrereleaseVersion(pkg.version)) {
    return false;
  }
  return isLatestTagViolation(pkg.version, readLatestDistTag(pkg.name));
}

function normalizeLicenseText(text) {
  return text.replace(/\r\n/g, "\n").trim();
}

function classifyLicense(tarballLicense, rootLicense) {
  if (tarballLicense === null) {
    return "missing";
  }
  return normalizeLicenseText(tarballLicense) === normalizeLicenseText(rootLicense)
    ? null
    : "mismatched";
}

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

function reportLatestTagViolations(violations) {
  console.error(
    `verify-npm-publish: ${violations.length} prerelease package(s) published in this run took ` +
      "over the latest dist-tag:",
  );
  for (const pkg of violations) {
    console.error(`  ${pkg.name}@${pkg.version} (dist-tags.latest points at it)`);
  }
  console.error(
    "Repair the dist-tag on npmjs.com with `npm dist-tag add`. To prevent a recurrence, give a " +
      "new package its first stable release before entering pre mode; see the note on the publish " +
      "step in .github/workflows/release.yml.",
  );
}

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
      "root LICENSE changed. Republishing is the only fix; a published tarball cannot be amended.",
  );
}

function main() {
  const packages = parsePublishedPackages(process.env.PUBLISHED_PACKAGES_JSON);
  const rootLicense = readFileSync(resolve(REPO_ROOT, "LICENSE"), "utf8");
  console.log(`verify-npm-publish: checking ${packages.length} published package(s).`);

  const latestTagViolations = [];
  const licenseFindings = [];
  for (const pkg of packages) {
    const tookOverLatest = tookOverLatestTag(pkg);
    const licenseProblem = classifyLicense(readPublishedLicense(pkg), rootLicense);
    if (tookOverLatest) {
      latestTagViolations.push(pkg);
    }
    if (licenseProblem !== null) {
      licenseFindings.push({ pkg, problem: licenseProblem });
    }
    const verdict = tookOverLatest || licenseProblem !== null ? "PROBLEM" : "ok";
    console.log(`  ${pkg.name}@${pkg.version} ... ${verdict}`);
  }

  if (latestTagViolations.length > 0) {
    reportLatestTagViolations(latestTagViolations);
    process.exitCode = 1;
  }
  if (licenseFindings.length > 0) {
    reportLicenseFindings(licenseFindings);
    process.exitCode = 1;
  }
  if (latestTagViolations.length === 0 && licenseFindings.length === 0) {
    console.log(
      "verify-npm-publish: no prerelease took over the latest dist-tag, every tarball carries the " +
        "root LICENSE.",
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`verify-npm-publish: ${message}`);
    process.exitCode = 1;
  }
}

export {
  classifyLicense,
  isLatestTagViolation,
  isPrereleaseVersion,
  normalizeLicenseText,
  parsePublishedPackages,
};
