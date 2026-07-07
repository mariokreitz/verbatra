import type { VerbatraConfig } from "@verbatra/sdk";
import { defaultExecFileImpl, resolveWatchedPaths, runGitLog } from "../git.js";
import { localeFilePath } from "../locale-paths.js";
import type { RpcHandler } from "../rpc.js";

/** The source file and every configured target locale file: the files the history view scopes `git log` to. */
function watchedLocalePaths(config: VerbatraConfig, projectRoot: string): string[] {
  const locales = [config.sourceLocale, ...config.targetLocales];
  return locales.map((locale) => localeFilePath(projectRoot, config.files.pattern, locale));
}

/**
 * Wraps a bounded `git log` (see `../git.js`, G25) scoped to the source and every target locale
 * file: reports the commit history that touched any of them, or `{ available: false }` when git
 * itself is missing or the project root is not inside a git repository at all. Never passes
 * `--follow`, so history before a file rename is not shown; this is a deliberate trade-off. A
 * shallow clone, or a locale file with no commits yet (freshly created, uncommitted, or added but
 * never committed), still answers `available: true`, with whatever commits genuinely exist.
 */
export const historyListHandler: RpcHandler<"history.list"> = async (params, deps) => {
  const execFileImpl = deps.execFileImpl ?? defaultExecFileImpl;
  const candidates = watchedLocalePaths(deps.config.config, deps.projectRoot);
  const watchedPaths = resolveWatchedPaths(deps.projectRoot, candidates);
  return runGitLog({
    execFileImpl,
    projectRoot: deps.projectRoot,
    watchedPaths,
    ...(params.limit !== undefined ? { limit: params.limit } : {}),
  });
};
