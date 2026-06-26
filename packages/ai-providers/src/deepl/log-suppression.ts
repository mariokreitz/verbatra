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
 * Resolve the loglevel instance deepl-node itself uses, via public module resolution only:
 * `require.resolve("deepl-node")` yields deepl-node's entry, and a `createRequire` rooted at
 * that entry loads the exact loglevel module deepl-node logs through. Returns `undefined` and
 * never throws if resolution fails, so a logging concern can never break client creation. The
 * `requireFn` parameter is a test seam: pass one whose `resolve` throws to exercise the
 * safe-degrade path.
 *
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
 * (translatable content) at debug via a shared loglevel logger named "deepl"; it is off by
 * default (warn), but the surrounding application could raise the global loglevel for its own
 * reasons and start logging user content. Pinning that logger to silent defends against this
 * regardless of host-app config. (The auth header is never passed to any log call, so the key
 * itself cannot leak via logging.)
 *
 * Suppression silences TWO loglevel instances. First, unconditionally, our own `loglevel`
 * import. Second, the loglevel instance deepl-node itself resolves (loaded via `createRequire`
 * from deepl-node's resolved entry). When pnpm dedupes both sides to one module, the two are
 * the same singleton and the second call is a harmless no-op; when a transitive change or a
 * deepl-node loglevel-range bump splits the install into two instances, the deepl-node-resolved
 * branch still silences the logger the SDK actually logs through. Suppression therefore no
 * longer depends on the dedupe outcome. Our own import is silenced first, so even if resolution
 * fails the package degrades to its current shipped behavior, not a regression.
 *
 * deepl-node and loglevel are pinned together by the `deepl-logging` Dependabot group, so a
 * loglevel range split is reviewed as a single PR rather than introduced silently.
 */
export function silenceSdkLogging(): void {
  silenceDeeplLogger([log, resolveDeeplLoglevel()]);
}
