import { execFile as execFileCb } from "node:child_process";
import { resolve as resolvePath, sep } from "node:path";
import { promisify } from "node:util";
import type { HistoryCommit, HistoryListResult } from "../shared/rpc/history.js";
import { withoutTrailingSep } from "./path-normalize.js";
import type { ExecFileImpl } from "./types.js";

const execFileAsync = promisify(execFileCb);

/**
 * Default {@link ExecFileImpl}: `node:child_process.execFile` via `util.promisify`, decoded as
 * utf8. Production wiring for the git-log history view; tests inject a stub instead.
 */
export const defaultExecFileImpl: ExecFileImpl = async (file, args, options) => {
  const { stdout, stderr } = await execFileAsync(file, args as string[], {
    cwd: options.cwd,
    encoding: "utf8",
  });
  return { stdout, stderr };
};

/** Default `--max-count` when `history.list` receives no `limit` (pinned at consolidation). */
export const HISTORY_LIMIT_DEFAULT = 50;
/** Hard cap on `--max-count`, regardless of what a caller requests (G25). */
export const HISTORY_LIMIT_CAP = 200;

/** Clamps a requested history limit to the server's bound: default 50, hard cap 200, never rejected. */
export function clampHistoryLimit(limit: number | undefined): number {
  return Math.min(limit ?? HISTORY_LIMIT_DEFAULT, HISTORY_LIMIT_CAP);
}

/** True when `candidate` is an absolute path equal to, or nested inside, `root`. */
export function isPathContained(root: string, candidate: string): boolean {
  const normalizedRoot = withoutTrailingSep(root);
  return candidate === normalizedRoot || candidate.startsWith(normalizedRoot + sep);
}

/**
 * True when a raw path argument could be misread as a git flag; such a path is never sent to git.
 * Must be checked against the raw candidate before it is resolved to an absolute path: once
 * resolved against an absolute `projectRoot`, a path can never start with a dash, so checking the
 * resolved form would never reject anything.
 */
export function hasLeadingDash(path: string): boolean {
  return path.startsWith("-");
}

/**
 * Resolves each candidate to an absolute path under `projectRoot` and drops anything that could be
 * misread as a flag or that escapes the root (G25). Both checks are defense in depth: a path built
 * from the project's own configuration never legitimately produces either shape, but a malformed
 * or unusual configuration must degrade by omission, not by handing git an unsafe argument. The
 * leading-dash check runs on each raw candidate, before resolution, since resolution against an
 * absolute root would make the check unable to ever fire. Duplicate resolved paths (for example
 * the same file used as both source and target) collapse to one entry.
 */
export function resolveWatchedPaths(projectRoot: string, candidates: readonly string[]): string[] {
  const root = resolvePath(projectRoot);
  const safe = candidates
    .filter((candidate) => !hasLeadingDash(candidate))
    .map((candidate) => resolvePath(root, candidate))
    .filter((candidate) => isPathContained(root, candidate));
  return Array.from(new Set(safe));
}

/** Record separator (ASCII RS) marking the start of each commit's header; unambiguous even if a subject is empty. */
const RECORD_SEPARATOR = "\x1e";
/** Field separator (ASCII US) between the header fields within one record. */
const FIELD_SEPARATOR = "\x1f";
const GIT_LOG_FORMAT = `${RECORD_SEPARATOR}%H${FIELD_SEPARATOR}%aI${FIELD_SEPARATOR}%s`;

/**
 * Builds the argument-array `git log` invocation (G25): bounded by `--max-count`, `--name-only`
 * with `-z` for NUL-separated parsing, and a `--` sentinel before every path so no path can ever
 * be misread as an option. Never includes `--follow`: history before a file rename is not shown,
 * a deliberate trade-off, not a bug.
 */
export function buildGitLogArgs(maxCount: number, paths: readonly string[]): string[] {
  return [
    "log",
    `--max-count=${maxCount}`,
    "--name-only",
    "-z",
    `--format=${GIT_LOG_FORMAT}`,
    "--",
    ...paths,
  ];
}

function parseCommitHeader(header: string): Omit<HistoryCommit, "touchedPaths"> | undefined {
  const [hash, authorDate, subject] = header.split(FIELD_SEPARATOR);
  if (hash === undefined || authorDate === undefined || subject === undefined) {
    return undefined;
  }
  return { hash, authorDate, subject };
}

function parseTouchedPaths(filesPart: string): string[] {
  return filesPart
    .split("\0")
    .map((entry) => (entry.startsWith("\n") ? entry.slice(1) : entry))
    .filter((entry) => entry.length > 0);
}

function parseCommitRecord(record: string): HistoryCommit | undefined {
  const nulIndex = record.indexOf("\0");
  const header = nulIndex === -1 ? record : record.slice(0, nulIndex);
  const parsedHeader = parseCommitHeader(header);
  if (parsedHeader === undefined) {
    return undefined;
  }
  const touchedPaths = nulIndex === -1 ? [] : parseTouchedPaths(record.slice(nulIndex + 1));
  return { ...parsedHeader, touchedPaths };
}

/** Parses the `-z`, `--name-only` output of a `git log` invocation built by {@link buildGitLogArgs}. */
export function parseGitLogOutput(stdout: string): HistoryCommit[] {
  return stdout
    .split(RECORD_SEPARATOR)
    .filter((record) => record.length > 0)
    .map(parseCommitRecord)
    .filter((commit): commit is HistoryCommit => commit !== undefined);
}

/** The minimal shape of a promisified `execFile` rejection this module distinguishes on. */
interface ExecFileFailure {
  readonly code?: string | number;
  readonly stderr?: string;
}

function isMissingGitBinary(error: ExecFileFailure): boolean {
  return error.code === "ENOENT";
}

function isNotARepository(error: ExecFileFailure): boolean {
  return typeof error.stderr === "string" && error.stderr.includes("not a git repository");
}

/**
 * Maps a `git log` failure to its result. `{ available: false }` is reserved for exactly the two
 * cases {@link HistoryListResult} documents: git itself is missing, or `projectRoot` is not inside
 * a git repository at all. Every other failure, notably an unborn branch with no commits yet,
 * still means the repository itself is fine; there is simply no history to report, so it answers
 * `available: true` with an empty commit list rather than propagating the error.
 */
function interpretGitLogFailure(error: unknown): HistoryListResult {
  const failure = error as ExecFileFailure;
  if (isMissingGitBinary(failure) || isNotARepository(failure)) {
    return { available: false };
  }
  return { available: true, commits: [] };
}

/** Input for {@link runGitLog}. */
export interface RunGitLogInput {
  /** The bounded, argument-array process runner (production default or an injected stub). */
  readonly execFileImpl: ExecFileImpl;
  /** Directory `git log` runs from; may be anywhere inside the repository, not necessarily its root. */
  readonly projectRoot: string;
  /** Absolute, already-contained paths to scope the log to (see {@link resolveWatchedPaths}). */
  readonly watchedPaths: readonly string[];
  /** Requested `--max-count`; clamped by {@link clampHistoryLimit}. */
  readonly limit?: number;
}

/**
 * Runs `git log` scoped to `watchedPaths` from `projectRoot` and returns the parsed result, never
 * throwing: a missing git binary or a non-repository directory degrades to `{ available: false }`
 * (see {@link interpretGitLogFailure}); an empty `watchedPaths` list (nothing to scope the log to)
 * short-circuits to an empty, available history without ever invoking git, since an unscoped `git
 * log` would report the whole repository's history instead of the watched locale files' history.
 */
export async function runGitLog(input: RunGitLogInput): Promise<HistoryListResult> {
  if (input.watchedPaths.length === 0) {
    return { available: true, commits: [] };
  }
  const args = buildGitLogArgs(clampHistoryLimit(input.limit), input.watchedPaths);
  try {
    const { stdout } = await input.execFileImpl("git", args, { cwd: input.projectRoot });
    return { available: true, commits: parseGitLogOutput(stdout) };
  } catch (error) {
    return interpretGitLogFailure(error);
  }
}
