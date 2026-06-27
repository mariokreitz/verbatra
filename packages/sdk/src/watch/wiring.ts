import { watch as chokidarWatch } from "chokidar";
import { translate } from "../flow/translate-project.js";
import type { CreateWatcher, RunTranslate, WatchDeps } from "./watch.js";

/** Production wiring for watch: the two IO seams (chokidar watcher and real translate runner) tests inject. */

/**
 * The production watcher wrapping chokidar; watches the given paths narrowly (a specific file).
 * ignoreInitial because watch does its own initial run. Both change and add map to one signal.
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

/** The production run: the one-shot translate(), with the non-secret deps passed through. */
export function defaultRunTranslate(deps: WatchDeps): RunTranslate {
  return (input) =>
    translate(input, {
      ...(deps.adapterRegistry !== undefined ? { adapterRegistry: deps.adapterRegistry } : {}),
      ...(deps.createProvider !== undefined ? { createProvider: deps.createProvider } : {}),
      ...(deps.fs !== undefined ? { fs: deps.fs } : {}),
    });
}
