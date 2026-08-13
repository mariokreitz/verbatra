import { createLocalePathResolver, type VerbatraConfig } from "@verbatra/sdk";
import { defaultExecFileImpl, resolveWatchedPaths, runGitLog } from "../git.js";
import type { RpcHandler } from "../rpc.js";

function watchedLocalePaths(config: VerbatraConfig, projectRoot: string): string[] {
  const resolver = createLocalePathResolver(projectRoot, config);
  return [config.sourceLocale, ...config.targetLocales].map((locale) => resolver.pathFor(locale));
}

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
