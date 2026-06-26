#!/usr/bin/env node
// Guards the repository against the em dash character (U+2014), which CLAUDE.md
// bans everywhere in the repo. Scans git-tracked text files and fails (exit 1)
// listing every offending file:line:col. The banned character is referenced only
// by its code point here, so this script never contains a literal U+2014.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const EM_DASH = String.fromCharCode(0x2014);

// Tracked files that are skipped: the lockfile (large, generated) and obvious
// binary formats by extension. A null byte in the content is a second guard.
const SKIP_FILES = new Set(["pnpm-lock.yaml"]);
const BINARY_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "ico",
  "icns",
  "pdf",
  "woff",
  "woff2",
  "ttf",
  "otf",
  "eot",
  "zip",
  "gz",
  "tgz",
  "wasm",
  "node",
]);

/**
 * @returns {string[]} repository-relative paths of all git-tracked files.
 */
function listTrackedFiles() {
  const output = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" });
  return output.split("\0").filter((path) => path.length > 0);
}

/**
 * @param {string} path
 * @returns {boolean}
 */
function isScannable(path) {
  if (SKIP_FILES.has(path)) {
    return false;
  }
  const dot = path.lastIndexOf(".");
  if (dot === -1) {
    return true;
  }
  const extension = path.slice(dot + 1).toLowerCase();
  return !BINARY_EXTENSIONS.has(extension);
}

/**
 * @typedef {{ file: string; line: number; column: number; text: string }} Hit
 */

/**
 * @param {string} text
 * @param {string} path
 * @param {number} line
 * @returns {Hit[]}
 */
function scanLine(text, path, line) {
  /** @type {Hit[]} */
  const hits = [];
  let column = text.indexOf(EM_DASH);
  while (column !== -1) {
    hits.push({ file: path, line, column: column + 1, text });
    column = text.indexOf(EM_DASH, column + 1);
  }
  return hits;
}

/**
 * `git ls-files` lists index entries; a file deleted on disk but not yet staged
 * is reported but cannot be read. A missing or unreadable file is not a
 * violation, so it is skipped rather than crashing the guard.
 * @param {string} path
 * @returns {Hit[]}
 */
function scanFile(path) {
  if (!existsSync(path)) {
    return [];
  }
  /** @type {string} */
  let content;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    return [];
  }
  if (content.includes("\0")) {
    return [];
  }
  if (!content.includes(EM_DASH)) {
    return [];
  }
  /** @type {Hit[]} */
  const hits = [];
  const lines = content.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    hits.push(...scanLine(lines[index] ?? "", path, index + 1));
  }
  return hits;
}

function main() {
  /** @type {Hit[]} */
  const hits = [];
  for (const path of listTrackedFiles()) {
    if (isScannable(path)) {
      hits.push(...scanFile(path));
    }
  }

  if (hits.length === 0) {
    console.log("check-no-em-dash: OK, no U+2014 found in tracked files.");
    return;
  }

  console.error(
    `check-no-em-dash: found ${hits.length} em dash (U+2014) occurrence(s). Replace each with a spaced hyphen, a colon, or parentheses:`,
  );
  for (const hit of hits) {
    console.error(`  ${hit.file}:${hit.line}:${hit.column}: ${hit.text.trim()}`);
  }
  process.exit(1);
}

main();
