import { createRequire } from "node:module";
import log from "loglevel";

/** Minimal structural view of a loglevel instance: enough to set a named logger's level. */
interface LevelSettableLogger {
  setLevel(level: "silent"): void;
}
interface LoglevelInstance {
  getLogger(name: string): LevelSettableLogger;
}

/** The named logger deepl-node resolves at module load and logs request content through. */
const DEEPL_LOGGER = "deepl";

/**
 * Resolve the exact loglevel instance deepl-node logs through. Returns `undefined` and never
 * throws if resolution fails, so a logging concern can never break client creation.
 *
 * @param requireFn - Test seam; pass one whose `resolve` throws to exercise the safe-degrade path.
 * @internal
 */
export function resolveDeeplLoglevel(
  requireFn: NodeRequire = createRequire(import.meta.url),
): LoglevelInstance | undefined {
  try {
    const entry = requireFn.resolve("deepl-node");
    return createRequire(entry)("loglevel") as LoglevelInstance;
  } catch {
    return undefined;
  }
}

/**
 * Silence the "deepl" logger on every provided loglevel instance. Skips any `undefined` entry
 * (a resolver that safely degraded), so a missing instance is a no-op rather than a throw.
 *
 * @internal
 */
export function silenceDeeplLogger(instances: readonly (LoglevelInstance | undefined)[]): void {
  for (const instance of instances) {
    instance?.getLogger(DEEPL_LOGGER).setLevel("silent");
  }
}

/**
 * Silence the deepl-node SDK's own request logging. deepl-node logs the request body
 * (translatable content) at debug through a shared loglevel logger named "deepl"; pinning it
 * to silent prevents a host app that raises the global loglevel from leaking user content.
 * Both our own loglevel import and the instance deepl-node resolves are silenced, so the
 * defense holds whether or not pnpm dedupes them to one module.
 */
export function silenceSdkLogging(): void {
  silenceDeeplLogger([log, resolveDeeplLoglevel()]);
}
