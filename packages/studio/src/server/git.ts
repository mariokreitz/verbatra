import { execFile as execFileCb } from "node:child_process";
import { resolve as resolvePath, sep } from "node:path";
import { promisify } from "node:util";
import type { HistoryCommit, HistoryListResult } from "../shared/rpc/history.js";
import { withoutTrailingSep } from "./path-normalize.js";
import type { ExecFileImpl } from "./types.js";

const execFileAsync = promisify(execFileCb);

export const defaultExecFileImpl: ExecFileImpl = async (file, args, options) => {
  const { stdout, stderr } = await execFileAsync(file, args as string[], {
    cwd: options.cwd,
    encoding: "utf8",
  });
  return { stdout, stderr };
};

export const HISTORY_LIMIT_DEFAULT = 50;
export const HISTORY_LIMIT_CAP = 200;

export function clampHistoryLimit(limit: number | undefined): number {
  return Math.min(limit ?? HISTORY_LIMIT_DEFAULT, HISTORY_LIMIT_CAP);
}

export function isPathContained(root: string, candidate: string): boolean {
  const normalizedRoot = withoutTrailingSep(root);
  return candidate === normalizedRoot || candidate.startsWith(normalizedRoot + sep);
}

export function hasLeadingDash(path: string): boolean {
  return path.startsWith("-");
}

export function resolveWatchedPaths(projectRoot: string, candidates: readonly string[]): string[] {
  const root = resolvePath(projectRoot);
  const safe = candidates
    .filter((candidate) => !hasLeadingDash(candidate))
    .map((candidate) => resolvePath(root, candidate))
    .filter((candidate) => isPathContained(root, candidate));
  return Array.from(new Set(safe));
}

const RECORD_SEPARATOR = "\x1e";
const FIELD_SEPARATOR = "\x1f";
const GIT_LOG_FORMAT = `${RECORD_SEPARATOR}%H${FIELD_SEPARATOR}%aI${FIELD_SEPARATOR}%s`;

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

export function parseGitLogOutput(stdout: string): HistoryCommit[] {
  return stdout
    .split(RECORD_SEPARATOR)
    .filter((record) => record.length > 0)
    .map(parseCommitRecord)
    .filter((commit): commit is HistoryCommit => commit !== undefined);
}

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

function interpretGitLogFailure(error: unknown): HistoryListResult {
  const failure = error as ExecFileFailure;
  if (isMissingGitBinary(failure) || isNotARepository(failure)) {
    return { available: false };
  }
  return { available: true, commits: [] };
}

export interface RunGitLogInput {
  readonly execFileImpl: ExecFileImpl;
  readonly projectRoot: string;
  readonly watchedPaths: readonly string[];
  readonly limit?: number;
}

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
