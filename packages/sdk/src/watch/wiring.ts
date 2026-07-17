import { watch as chokidarWatch } from "chokidar";
import { translate } from "../flow/translate-project.js";
import type { CreateWatcher, RunTranslate, WatchDeps } from "./watch.js";

/**
 * The production watcher wrapping chokidar; watches exactly the given paths. `ignoreInitial` is set
 * because watch does its own initial run. Both change and add events map to one signal.
 */
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

/** The production run for a watch trigger: the one-shot translate(), with the deps passed through. */
export function defaultRunTranslate(deps: WatchDeps): RunTranslate {
  return (input) =>
    translate(input, {
      ...(deps.adapterRegistry !== undefined ? { adapterRegistry: deps.adapterRegistry } : {}),
      ...(deps.createProvider !== undefined ? { createProvider: deps.createProvider } : {}),
      ...(deps.fs !== undefined ? { fs: deps.fs } : {}),
    });
}
