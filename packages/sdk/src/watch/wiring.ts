import { watch as chokidarWatch } from "chokidar";
import { translate } from "../flow/translate-project.js";
import type { CreateWatcher, RunTranslate, WatchDeps } from "./watch.js";

/**
 * Production wiring for watch: the two seams that reach real IO and are therefore excluded from
 * coverage (like the providers' client.ts seams): the chokidar watcher, and the runner that calls
 * the real one-shot translate(). The state machine in watch.ts injects these in tests.
 */

/**
 * The production watcher: wraps chokidar. It watches the given file path(s) NARROWLY (a specific
 * file, not a directory tree). ignoreInitial is set because watch does its own initial run, and
 * chokidar's default atomic handling coalesces the editor/adapter temp+rename pattern into a single
 * change. Both change and add map to one "source changed" signal; the caller debounces.
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
