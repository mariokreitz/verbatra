/**
 * Keeps the two documentation tables that claim completeness from drifting away from the source
 * they describe.
 *
 * Both pages make a promise a reader relies on: the providers page lists the provider error codes a
 * failure can carry, and the SDK page says it catalogs the whole public surface. Nothing enforced
 * either promise, so both had silently fallen behind the code (a `ProviderErrorCode` member and a
 * value export were each missing from their table). A reference that promises completeness and is
 * not complete stops being trustworthy for every other lookup too, so the promise is asserted here
 * rather than left to review.
 *
 * The two checks read the source of truth directly (the `ProviderErrorCode` union and the index
 * export list) and compare it against the rendered MDX, in every locale: the codes and export names
 * are code tokens kept verbatim across translations, so a mirror that drops one is as much a drift
 * as an English page that does.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The locale suffixes every doc page is mirrored into, `""` being the English source. */
const LOCALE_SUFFIXES = ["", ".de", ".es", ".fr"];

/** Read a repository-relative file as text. */
function readRepoFile(relativePath) {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8");
}

/** Read one locale mirror of a doc page, given its path around the locale suffix. */
function readDocPage(prefix, suffix) {
  return readRepoFile(`apps/docs/content/docs/${prefix}${suffix}.mdx`);
}

/** The string-literal members of the `ProviderErrorCode` union, sorted. */
function providerErrorCodes() {
  const source = readRepoFile("packages/ai-providers/src/errors.ts");
  const union = /export type ProviderErrorCode =([\s\S]*?);/.exec(source);
  if (union?.[1] === undefined) {
    throw new Error("the ProviderErrorCode union could not be located in errors.ts");
  }
  return [...union[1].matchAll(/"([A-Z_]+)"/g)].map((match) => match[1]).sort();
}

/** The codes the providers page's structured-error table has a row for, sorted. */
function documentedErrorCodes(suffix) {
  const page = readDocPage("(configure)/providers", suffix);
  return [...page.matchAll(/^\| `([A-Z_]+)` \|/gm)].map((match) => match[1]).sort();
}

/**
 * The runtime (non-type) export names of the SDK entry point, sorted. `export type { ... }` blocks
 * are skipped whole, and `type`-prefixed members are dropped from mixed blocks, so only the values
 * a consumer can actually import at runtime are required to appear in the reference.
 */
function sdkValueExports() {
  const source = readRepoFile("packages/sdk/src/index.ts");
  const names = new Set();
  for (const block of source.matchAll(/export\s+(type\s+)?\{([\s\S]*?)\}\s+from\s+"[^"]+";/g)) {
    if (block[1] !== undefined) {
      continue;
    }
    for (const raw of block[2].split(",")) {
      const member = raw.trim();
      if (member !== "" && !member.startsWith("type ")) {
        names.add(member.split(/\s+as\s+/)[0].trim());
      }
    }
  }
  return [...names].sort();
}

/**
 * Whether the SDK reference mentions an export, either as an inline code span or as the heading of
 * the section documenting it (entry points get a `### name` heading, constants a code span).
 */
function mentionsExport(page, name) {
  return page.includes(`\`${name}\``) || new RegExp(`^#{2,4} ${name}\\s*$`, "m").test(page);
}

describe("the providers page documents every provider error code", () => {
  const codes = providerErrorCodes();

  it("extracts a non-trivial union, so the comparisons cannot pass vacuously", () => {
    expect(codes.length).toBeGreaterThanOrEqual(10);
    expect(codes).toContain("PROVIDER_ERROR");
  });

  it.each(LOCALE_SUFFIXES)("has one table row per code in providers%s.mdx", (suffix) => {
    expect(documentedErrorCodes(suffix)).toEqual(codes);
  });
});

describe("the SDK reference catalogs the whole public surface", () => {
  const exportNames = sdkValueExports();

  it("extracts a non-trivial export list, so the comparisons cannot pass vacuously", () => {
    expect(exportNames.length).toBeGreaterThanOrEqual(25);
    expect(exportNames).toContain("translate");
  });

  it.each(LOCALE_SUFFIXES)("mentions every value export in sdk%s.mdx", (suffix) => {
    const page = readDocPage("(sdk)/sdk", suffix);

    expect(exportNames.filter((name) => !mentionsExport(page, name))).toEqual([]);
  });
});
