import { join } from "node:path";
import type { SdkFs } from "../../fs.js";
import { findLocaleTokens, isLocaleToken } from "./locale-token.js";

/** What a single candidate directory turned out to hold. */
export type DirectoryScan =
  | {
      /** One template covers every locale-bearing entry in the directory. */
      readonly kind: "layout";
      /** The `files.pattern` value, relative to the working directory, carrying one `{locale}` token. */
      readonly pattern: string;
      /** Every locale the template covers, in the order the directory listed them. */
      readonly locales: readonly string[];
    }
  | {
      /** Nothing in the directory looks like a set of locale files. */
      readonly kind: "none";
    }
  | {
      /**
       * Several templates each cover part of the directory, which is what a project with more than
       * one namespace per locale looks like. Not representable: verbatra maps one file per locale.
       */
      readonly kind: "partial";
      /** The competing templates, so the message can show the user what was found. */
      readonly patterns: readonly string[];
    };

const SEPARATOR = "/";

/** Template to the locales it covers, each mapped to the entry that produced it. */
type Candidates = Map<string, Map<string, string>>;

function record(candidates: Candidates, template: string, locale: string, item: string): void {
  const covered = candidates.get(template) ?? new Map<string, string>();
  covered.set(locale, item);
  candidates.set(template, covered);
}

function addFlatEntries(
  candidates: Candidates,
  fileNames: readonly string[],
  prefix: string,
): void {
  for (const name of fileNames) {
    for (const { locale, start, end } of findLocaleTokens(name)) {
      const template = `${prefix}${name.slice(0, start)}{locale}${name.slice(end)}`;
      record(candidates, template, locale, name);
    }
  }
}

function addNestedEntries(
  candidates: Candidates,
  listings: ReadonlyMap<string, readonly string[]>,
  prefix: string,
): void {
  for (const [locale, fileNames] of listings) {
    for (const name of fileNames) {
      const item = `${locale}${SEPARATOR}${name}`;
      record(candidates, `${prefix}{locale}${SEPARATOR}${name}`, locale, item);
    }
  }
}

function selectTemplate(candidates: Candidates): DirectoryScan {
  const viable = [...candidates].filter(([, covered]) => covered.size >= 2);
  if (viable.length === 0) {
    return { kind: "none" };
  }
  const items = new Set(viable.flatMap(([, covered]) => [...covered.values()]));
  const full = viable.filter(([, covered]) => new Set(covered.values()).size === items.size);
  const [winner, runnerUp] = full;
  if (winner === undefined || runnerUp !== undefined) {
    return { kind: "partial", patterns: viable.map(([template]) => template).sort() };
  }
  return { kind: "layout", pattern: winner[0], locales: [...winner[1].keys()] };
}

async function listLocaleSubdirectories(
  fs: DetectionFs,
  absoluteDir: string,
  directoryNames: readonly string[],
): Promise<ReadonlyMap<string, readonly string[]>> {
  const listings = new Map<string, readonly string[]>();
  for (const name of directoryNames.filter(isLocaleToken)) {
    const entries = await fs.readDirectory(join(absoluteDir, name));
    const files = entries.filter((entry) => !entry.isDirectory).map((entry) => entry.name);
    if (files.length > 0) {
      listings.set(name, files);
    }
  }
  return listings;
}

/** The one file-system capability detection needs beyond what {@link SdkFs} already requires. */
export type DetectionFs = Required<Pick<SdkFs, "readDirectory">>;

/**
 * Scans one candidate directory for a locale layout verbatra can express as a `files.pattern`.
 *
 * Both shapes real projects use are considered: locale-named files sitting directly in the
 * directory (`en.json`, `messages.de.json`, `app_pt-BR.arb`) and locale-named subdirectories holding
 * namespace files (`en/common.json`). A layout is only reported when a single template covers every
 * locale-bearing entry and covers at least two locales, so a directory verbatra could represent only
 * in part is reported as `partial` rather than silently narrowed to whichever part happens to fit.
 *
 * @param fs - File system to list through.
 * @param cwd - Directory `relativeDir` and the returned pattern are relative to.
 * @param relativeDir - The candidate directory, relative to `cwd`, in POSIX spelling.
 * @returns What the directory holds. Does not throw; an absent or unreadable directory is `none`.
 */
export async function scanDirectory(
  fs: DetectionFs,
  cwd: string,
  relativeDir: string,
): Promise<DirectoryScan> {
  const absoluteDir = join(cwd, relativeDir);
  const entries = await fs.readDirectory(absoluteDir);
  if (entries.length === 0) {
    return { kind: "none" };
  }
  const prefix = `${relativeDir}${SEPARATOR}`;
  const listings = await listLocaleSubdirectories(
    fs,
    absoluteDir,
    entries.filter((entry) => entry.isDirectory).map((entry) => entry.name),
  );
  const candidates: Candidates = new Map();
  addFlatEntries(
    candidates,
    entries.filter((entry) => !entry.isDirectory).map((entry) => entry.name),
    prefix,
  );
  addNestedEntries(candidates, listings, prefix);
  return selectTemplate(candidates);
}
