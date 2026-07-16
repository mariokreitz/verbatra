import log from "loglevel";
import { describe, expect, it } from "vitest";
import { resolveDeeplLoglevel, silenceDeeplLogger, silenceSdkLogging } from "./log-suppression.js";

/** A fake loglevel instance that records the level its "deepl" logger was set to. */
function createFakeLoglevel(): {
  instance: ReturnType<typeof makeFake>;
  level: () => string | undefined;
} {
  let recorded: string | undefined;
  const instance = makeFake((level) => {
    recorded = level;
  });
  return { instance, level: () => recorded };
}

function makeFake(onSet: (level: "silent") => void) {
  return {
    getLogger(_name: string) {
      return {
        setLevel(level: "silent") {
          onSet(level);
        },
      };
    },
  };
}

describe("DeepL SDK log suppression", () => {
  it("actually silences the 'deepl' logger our loglevel import returns (AC3)", () => {
    log.getLogger("deepl").setLevel("debug");
    silenceSdkLogging();
    expect(log.getLogger("deepl").getLevel()).toBe(log.levels.SILENT);
  });

  it("silences the 'deepl' logger on the instance deepl-node actually resolves (AC1)", () => {
    const resolved = resolveDeeplLoglevel();
    expect(resolved).toBeDefined();
    const deeplNodeLog = resolved as unknown as typeof log;
    deeplNodeLog.getLogger("deepl").setLevel("debug");
    silenceSdkLogging();
    expect(deeplNodeLog.getLogger("deepl").getLevel()).toBe(deeplNodeLog.levels.SILENT);
  });

  it("silences BOTH instances under a split, proving no content reaches a separate logger (AC2)", () => {
    const ours = createFakeLoglevel();
    const deeplNodes = createFakeLoglevel();
    silenceDeeplLogger([ours.instance, deeplNodes.instance]);
    expect(ours.level()).toBe("silent");
    expect(deeplNodes.level()).toBe("silent");
  });

  it("resolveDeeplLoglevel returns undefined and does not throw when resolution fails", () => {
    const throwingRequire = {
      resolve() {
        throw new Error("cannot resolve deepl-node");
      },
    } as unknown as NodeRequire;
    expect(() => resolveDeeplLoglevel(throwingRequire)).not.toThrow();
    expect(resolveDeeplLoglevel(throwingRequire)).toBeUndefined();
  });

  it("silenceDeeplLogger skips an undefined instance without throwing", () => {
    expect(() => silenceDeeplLogger([undefined])).not.toThrow();
  });
});
