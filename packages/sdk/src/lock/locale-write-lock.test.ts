import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SdkError } from "../errors.js";
import type { SdkFs } from "../fs.js";
import { makeFakeFs } from "../test-support.js";
import { localeLockPath, withLocaleWriteLock } from "./locale-write-lock.js";

function sleep(ms: number): Promise<void> {
  return new Promise((res) => {
    setTimeout(res, ms);
  });
}

/**
 * An in-memory {@link SdkFs} whose `createExclusive`/`deleteFile` behave exactly like a real
 * exclusive-create lock file: a `Set` of currently "held" paths. Used to drive real mutual
 * exclusion through `withLocaleWriteLock`'s actual acquire/release loop, not by injection timing.
 */
function makeLockFs(): SdkFs {
  const held = new Set<string>();
  return makeFakeFs({
    createExclusive: async (path: string): Promise<boolean> => {
      if (held.has(path)) {
        return false;
      }
      held.add(path);
      return true;
    },
    deleteFile: async (path: string): Promise<void> => {
      held.delete(path);
    },
  });
}

describe("localeLockPath", () => {
  it("resolves under .verbatra-local/locks/<locale>.lock", () => {
    const path = localeLockPath("/proj", "de");
    expect(path).toBe(join("/proj", ".verbatra-local", "locks", "de.lock"));
  });
});

describe("withLocaleWriteLock: mutual exclusion", () => {
  it("never runs two callbacks for the same (cwd, locale) concurrently (proof by construction, not timing luck)", async () => {
    const fs = makeLockFs();
    let insideCount = 0;
    let maxInsideCount = 0;
    const order: string[] = [];

    async function criticalSection(id: string, workMs: number): Promise<void> {
      insideCount += 1;
      maxInsideCount = Math.max(maxInsideCount, insideCount);
      order.push(`${id}-start`);
      await sleep(workMs);
      order.push(`${id}-end`);
      insideCount -= 1;
    }

    const options = { pollIntervalMs: 5, acquireTimeoutMs: 2000 };
    const a = withLocaleWriteLock("/proj", "de", fs, () => criticalSection("A", 30), options);
    const b = withLocaleWriteLock("/proj", "de", fs, () => criticalSection("B", 5), options);

    await Promise.all([a, b]);

    expect(maxInsideCount).toBe(1);
    // A claims the lock first (its synchronous createExclusive call runs before B's, in the same
    // tick), so it must fully finish (start and end) before B ever starts.
    expect(order).toEqual(["A-start", "A-end", "B-start", "B-end"]);
  });

  it("a different locale never contends with another locale's lock", async () => {
    const fs = makeLockFs();
    const order: string[] = [];
    const options = { pollIntervalMs: 5, acquireTimeoutMs: 2000 };

    async function section(id: string): Promise<void> {
      order.push(`${id}-start`);
      await sleep(10);
      order.push(`${id}-end`);
    }

    await Promise.all([
      withLocaleWriteLock("/proj", "de", fs, () => section("de"), options),
      withLocaleWriteLock("/proj", "fr", fs, () => section("fr"), options),
    ]);

    // Both start before either ends: they ran concurrently, unlike the same-locale case above.
    expect(order.indexOf("de-end")).toBeGreaterThan(order.indexOf("fr-start"));
    expect(order.indexOf("fr-end")).toBeGreaterThan(order.indexOf("de-start"));
  });

  it("releases the lock (deletes the lock file) even when fn throws", async () => {
    const fs = makeLockFs();
    const options = { pollIntervalMs: 5, acquireTimeoutMs: 2000 };

    await expect(
      withLocaleWriteLock(
        "/proj",
        "de",
        fs,
        async () => {
          throw new Error("boom");
        },
        options,
      ),
    ).rejects.toThrow("boom");

    // The lock was released: a second acquire on the same locale succeeds immediately.
    let ran = false;
    await withLocaleWriteLock(
      "/proj",
      "de",
      fs,
      async () => {
        ran = true;
      },
      options,
    );
    expect(ran).toBe(true);
  });
});

describe("withLocaleWriteLock: contention timeout", () => {
  it("throws a structured LOCK_CONTENDED naming the lock path once the timeout elapses, and never runs fn", async () => {
    const fs = makeFakeFs({ createExclusive: async (): Promise<boolean> => false });
    let ran = false;

    const error = await withLocaleWriteLock(
      "/proj",
      "de",
      fs,
      async () => {
        ran = true;
      },
      { pollIntervalMs: 5, acquireTimeoutMs: 20 },
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SdkError);
    expect((error as SdkError).code).toBe("LOCK_CONTENDED");
    expect((error as SdkError).message).toContain(localeLockPath("/proj", "de"));
    expect(ran).toBe(false);
  });
});
