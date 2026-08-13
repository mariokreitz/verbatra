import { watch as chokidarWatch } from "chokidar";
import { translate } from "../flow/translate-project.js";
import type { CreateWatcher, RunTranslate, WatchDeps } from "./watch.js";

export const defaultCreateWatcher: CreateWatcher = (paths) => {
  const fsWatcher = chokidarWatch([...paths], { persistent: true, ignoreInitial: true });
  return {
    onChange(listener: () => void): void {
      fsWatcher.on("change", () => listener());
      fsWatcher.on("add", () => listener());
    },
    close: () => fsWatcher.close(),
  };
};

export function defaultRunTranslate(deps: WatchDeps): RunTranslate {
  return (input) =>
    translate(input, {
      ...(deps.adapterRegistry !== undefined ? { adapterRegistry: deps.adapterRegistry } : {}),
      ...(deps.createProvider !== undefined ? { createProvider: deps.createProvider } : {}),
      ...(deps.fs !== undefined ? { fs: deps.fs } : {}),
    });
}
