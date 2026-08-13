import { createRequire } from "node:module";
import log from "loglevel";

interface LevelSettableLogger {
  setLevel(level: "silent"): void;
}
interface LoglevelInstance {
  getLogger(name: string): LevelSettableLogger;
}

const DEEPL_LOGGER = "deepl";

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

export function silenceDeeplLogger(instances: readonly (LoglevelInstance | undefined)[]): void {
  for (const instance of instances) {
    instance?.getLogger(DEEPL_LOGGER).setLevel("silent");
  }
}

export function silenceSdkLogging(): void {
  silenceDeeplLogger([log, resolveDeeplLoglevel()]);
}
