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
 * Both checks read the source of truth directly rather than the built `dist`: the published surface
 * is generated from `packages/sdk/src/index.ts`, that file is what a reviewer edits, and nothing
 * builds the workspace before this guard runs.
 *
 * The SDK surface splits in two by how the page documents it, and each half is asserted the
 * strongest way its shape allows:
 *
 * - Entry points (the camelCase value exports) must each own a section heading, and the set of such
 *   headings must equal the set of entry points exactly. Two-way equality is what catches an export
 *   that left `index.ts` and lingers on the page as a ghost, and requiring the heading form is what
 *   stops a short name like `check` or `diff` from being satisfied by unrelated prose elsewhere on
 *   the page. Headings that are not a bare camelCase identifier are ordinary prose and ignored.
 * - The remaining value exports (the file-name constants and the `SdkError` class) are documented
 *   inline, where a heading would not make sense. Their names cannot collide with prose, so presence
 *   as a code span is enough; on top of that, every constant that resolves to a string literal must
 *   have that literal on the page, so the page is checked against the value it publishes and not
 *   only against the name.
 *
 * Every locale mirror is checked, not the English source alone: error codes, export names, and file
 * names are code tokens that stay verbatim across translations, so a mirror that drops a section is
 * as much a drift as an English page that does.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The locale suffixes every doc page is mirrored into, `""` being the English source. */
const LOCALE_SUFFIXES = ["", ".de", ".es", ".fr"];

/** A heading counts as documenting an entry point only when its whole text is one such name. */
const ENTRY_POINT_NAME = /^[a-z][A-Za-z0-9]*$/;

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

/** The runtime export names one `export { ... } from "..."` block contributes. */
function blockExportNames(members) {
  const names = [];
  for (const raw of members.split(",")) {
    const member = raw.trim();
    if (member !== "" && !member.startsWith("type ")) {
      names.push(member.split(/\s+as\s+/)[0].trim());
    }
  }
  return names;
}

/**
 * The runtime (non-type) exports of the SDK entry point as `{ name, module }` pairs, sorted by name.
 * `export type { ... }` blocks are skipped whole, and `type`-prefixed members are dropped from mixed
 * blocks, so only the values a consumer can actually import at runtime are required to appear in the
 * reference. The module specifier is kept so a constant's declared value can be resolved later.
 */
function sdkValueExports() {
  const source = readRepoFile("packages/sdk/src/index.ts");
  const exports = [];
  for (const block of source.matchAll(/export\s+(type\s+)?\{([\s\S]*?)\}\s+from\s+"([^"]+)";/g)) {
    if (block[1] !== undefined) {
      continue;
    }
    for (const name of blockExportNames(block[2])) {
      exports.push({ name, module: block[3] });
    }
  }
  return exports.sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * The string literal a locally declared `export const NAME = "value";` binds, or `undefined` when
 * the export is not a local string constant (a class, an object, or a re-export from another
 * package).
 */
function resolveStringConstant({ name, module }) {
  if (!module.startsWith("./")) {
    return undefined;
  }
  const source = readRepoFile(`packages/sdk/src/${module.slice(2).replace(/\.js$/, ".ts")}`);
  return new RegExp(`export const ${name} = "([^"]*)";`).exec(source)?.[1];
}

/** The export names the SDK reference gives a section heading of their own, sorted. */
function headingDocumentedExports(page) {
  return [...page.matchAll(/^#{2,4}\s+(\S+)[ \t]*$/gm)]
    .map((match) => match[1])
    .filter((text) => ENTRY_POINT_NAME.test(text))
    .sort();
}

/** Whether the page carries a token as an inline code span. */
function mentionsCodeSpan(page, token) {
  return page.includes(`\`${token}\``);
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
  const valueExports = sdkValueExports();
  const entryPoints = valueExports
    .map(({ name }) => name)
    .filter((name) => ENTRY_POINT_NAME.test(name))
    .sort();
  const inlineExports = valueExports.filter(({ name }) => !ENTRY_POINT_NAME.test(name));
  const constants = inlineExports
    .map((entry) => ({ name: entry.name, value: resolveStringConstant(entry) }))
    .filter((entry) => entry.value !== undefined);

  it("extracts a non-trivial export list, so the comparisons cannot pass vacuously", () => {
    expect(entryPoints.length).toBeGreaterThanOrEqual(15);
    expect(entryPoints).toContain("translate");
    expect(inlineExports.map(({ name }) => name)).toContain("SdkError");
    expect(constants.length).toBeGreaterThanOrEqual(4);
  });

  it.each(LOCALE_SUFFIXES)("heads one section per entry point in sdk%s.mdx", (suffix) => {
    expect(headingDocumentedExports(readDocPage("(sdk)/sdk", suffix))).toEqual(entryPoints);
  });

  it.each(LOCALE_SUFFIXES)("names every inline value export in sdk%s.mdx", (suffix) => {
    const page = readDocPage("(sdk)/sdk", suffix);

    expect(inlineExports.filter(({ name }) => !mentionsCodeSpan(page, name))).toEqual([]);
  });

  it.each(LOCALE_SUFFIXES)("prints the value each constant holds in sdk%s.mdx", (suffix) => {
    const page = readDocPage("(sdk)/sdk", suffix);

    expect(constants.filter(({ value }) => !mentionsCodeSpan(page, value))).toEqual([]);
  });
});

describe("the SDK heading rule separates real drift from ordinary prose", () => {
  const page = readDocPage("(sdk)/sdk", "");

  it("sees an export that left index.ts but kept its section", () => {
    expect(headingDocumentedExports(`${page}\n### resetLockFile\n`)).toContain("resetLockFile");
  });

  it("is not satisfied by an incidental code span once the section is gone", () => {
    const stripped = page.replace(/^### check$/m, "### Inspecting state without writing");

    expect(stripped).toContain("`check`");
    expect(headingDocumentedExports(stripped)).not.toContain("check");
  });

  it("ignores prose headings, so ordinary documentation cannot trip the check", () => {
    const prose = "## Install\n\n### The workbook pair\n\n#### Notes on Config\n";

    expect(headingDocumentedExports(prose)).toEqual([]);
  });
});
