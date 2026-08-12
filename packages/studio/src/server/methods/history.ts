import { createLocalePathResolver, type VerbatraConfig } from "@verbatra/sdk";
import { defaultExecFileImpl, resolveWatchedPaths, runGitLog } from "../git.js";
import type { RpcHandler } from "../rpc.js";

/** The source file and every configured target locale file: the files the history view scopes `git log` to. */
function watchedLocalePaths(config: VerbatraConfig, projectRoot: string): string[] {
  const resolver = createLocalePathResolver(projectRoot, config);
  return [config.sourceLocale, ...config.targetLocales].map((locale) => resolver.pathFor(locale));
}

/**
 * Handles `history.list`: runs a bounded `git log` (see `../git.js`) scoped to the source file
 * and every configured target locale file, and reports the commits that touched any of them, or
 * `{ available: false }` when git itself is missing or the project root is not inside a git
 * repository. `--follow` is never passed, so history before a file rename is not shown; this is
 * a deliberate trade-off. A locale file with no commits yet still answers `available: true`,
 * with whatever commits genuinely exist.
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
