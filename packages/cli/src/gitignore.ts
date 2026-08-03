import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Streams } from "./types.js";

/**
 * The paths a verbatra project must keep out of version control.
 *
 * `.env` and `.env.local` hold real provider keys. `.verbatra-local/` holds process-local,
 * never-committed state (the run-status snapshot `translate` and `watch` write, and the per-locale
 * write lock files under `locks/`). `verbatra.cache.json` is the local, regenerable
 * translation-memory cache: safe to delete at any time, which rebuilds it naturally on the next
 * run, and never committed.
 */
const GITIGNORE_ENTRIES = [".env", ".env.local", ".verbatra-local/", "verbatra.cache.json"];

/** Which entries an existing `.gitignore` does not already list, compared line by line and trimmed. */
function missingEntries(content: string): string[] {
  const present = new Set(content.split(/\r?\n/).map((line) => line.trim()));
  return GITIGNORE_ENTRIES.filter((entry) => !present.has(entry));
}

/** Append the given entries, prefixing a newline only when a non-empty file lacks a trailing one. */
function appendEntries(path: string, content: string, entries: readonly string[]): void {
  const prefix = content.length === 0 || content.endsWith("\n") ? "" : "\n";
  appendFileSync(path, `${prefix}${entries.join("\n")}\n`);
}

/**
 * Ensures every {@link GITIGNORE_ENTRIES} path is gitignored at `cwd`: creates the file if absent,
 * otherwise appends only the entries not already present, so re-running `init` never duplicates
 * them. Reports what it did, which is why this variant is for `init` and not the run path.
 */
export function ensureGitignore(cwd: string, streams: Streams): void {
  const gitignorePath = resolve(cwd, ".gitignore");
  if (!existsSync(gitignorePath)) {
    writeFileSync(
      gitignorePath,
      `# Local environment files (never commit real keys)\n${GITIGNORE_ENTRIES.join("\n")}\n`,
    );
    streams.out(`created .gitignore (${GITIGNORE_ENTRIES.join(", ")})\n`);
    return;
  }
  const content = readFileSync(gitignorePath, "utf8");
  const missing = missingEntries(content);
  if (missing.length === 0) {
    streams.out(`.gitignore already ignores ${GITIGNORE_ENTRIES.join(", ")}\n`);
    return;
  }
  appendEntries(gitignorePath, content, missing);
  streams.out(`updated .gitignore (added ${missing.join(", ")})\n`);
}

/**
 * The run-path counterpart of {@link ensureGitignore}: tops up an existing `.gitignore` with any
 * entry it is missing, and does nothing otherwise.
 *
 * This exists because `init` was the only place that ever wrote these entries, so every project
 * scaffolded before an entry was introduced never received it. `verbatra.cache.json` is the case
 * that matters: it is created at the project root by every write path, so upgrading users got a new
 * untracked file they were liable to commit, contradicting its own documented contract.
 * `.verbatra-local/` is the same defect one release earlier, and this covers both identically.
 *
 * Three deliberate limits, all narrower than the `init` variant:
 *
 * - It never creates a `.gitignore`. Absent means the project is not using one, and materializing
 *   it under someone during an ordinary translate is a bigger surprise than the untracked file.
 * - It is silent. `--json` puts a single summary object on stdout, and nothing here may disturb it.
 * - It never throws. An unwritable or racing `.gitignore` is not a reason to fail a translation, so
 *   any error is swallowed and the run proceeds.
 *
 * It decides purely on file presence and content: no `git` subprocess, no work-tree detection, no
 * new dependency. A user who has deliberately un-ignored one of these paths would be surprised by
 * the append; that is a judgement call, weighed against a silent untracked artifact.
 *
 * @param cwd - The project directory whose `.gitignore` to top up.
 */
export function appendMissingGitignoreEntries(cwd: string): void {
  try {
    const gitignorePath = resolve(cwd, ".gitignore");
    if (!existsSync(gitignorePath)) {
      return;
    }
    const content = readFileSync(gitignorePath, "utf8");
    const missing = missingEntries(content);
    if (missing.length > 0) {
      appendEntries(gitignorePath, content, missing);
    }
  } catch {}
}
