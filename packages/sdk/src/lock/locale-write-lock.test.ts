import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SdkError } from "../errors.js";
import type { SdkFs } from "../fs.js";
import { makeFakeFs } from "../test-support.js";
import {
  type LockWaitEvent,
  localeLockPath,
  lockFileGuardPath,
  withLocaleWriteLock,
  withLockFileGuard,
} from "./locale-write-lock.js";

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

describe("lockFileGuardPath", () => {
  it("resolves under .verbatra-local/locks/_lockfile.lock, a stem no real BCP-47 locale tag ever starts with", () => {
    const path = lockFileGuardPath("/proj");
    expect(path).toBe(join("/proj", ".verbatra-local", "locks", "_lockfile.lock"));
  });
});

describe("withLockFileGuard: mutual exclusion", () => {
  it("never runs two callbacks for the same cwd concurrently", async () => {
    const fs = makeLockFs();
    let insideCount = 0;
    let maxInsideCount = 0;

    async function criticalSection(): Promise<void> {
      insideCount += 1;
      maxInsideCount = Math.max(maxInsideCount, insideCount);
      await sleep(20);
      insideCount -= 1;
    }

    const options = { pollIntervalMs: 5, acquireTimeoutMs: 2000 };
    await Promise.all([
      withLockFileGuard("/proj", fs, criticalSection, options),
      withLockFileGuard("/proj", fs, criticalSection, options),
    ]);

    expect(maxInsideCount).toBe(1);
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

  it("honors a short acquireTimeoutMs override rather than the ten-minute default", async () => {
    const fs = makeFakeFs({ createExclusive: async (): Promise<boolean> => false });
    const startedAt = Date.now();

    const error = await withLocaleWriteLock("/proj", "de", fs, async () => {}, {
      pollIntervalMs: 5,
      acquireTimeoutMs: 30,
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SdkError);
    expect((error as SdkError).code).toBe("LOCK_CONTENDED");
    expect(Date.now() - startedAt).toBeLessThan(60_000);
  });
});

describe("withLocaleWriteLock: wait progress", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /** A fake fs whose exclusive-create fails `failures` times, then succeeds, returning a fixed payload. */
  function makeContendedFs(failures: number, payload: SdkFs["readFileBounded"]): SdkFs {
    let attempts = 0;
    return makeFakeFs({
      createExclusive: async (): Promise<boolean> => {
        attempts += 1;
        return attempts > failures;
      },
      readFileBounded: payload,
    });
  }

  it("invokes onWait once after the first failed acquire, carrying the holder pid and acquiredAt", async () => {
    vi.useFakeTimers();
    const fs = makeContendedFs(1, async () => ({
      kind: "ok",
      content: JSON.stringify({ pid: 4321, acquiredAt: "2026-07-18T00:00:00.000Z" }),
    }));
    const events: LockWaitEvent[] = [];
    let ran = false;

    const promise = withLocaleWriteLock(
      "/proj",
      "de",
      fs,
      async () => {
        ran = true;
      },
      { pollIntervalMs: 50, acquireTimeoutMs: 5_000, onWait: (event) => events.push(event) },
    );
    await vi.advanceTimersByTimeAsync(100);
    await promise;

    expect(ran).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      lockPath: localeLockPath("/proj", "de"),
      holder: { pid: 4321, acquiredAt: "2026-07-18T00:00:00.000Z" },
    });
  });

  it("still invokes onWait, without holder fields, when the lock payload is malformed and never throws", async () => {
    vi.useFakeTimers();
    const fs = makeContendedFs(1, async () => ({ kind: "ok", content: "{ not valid json" }));
    const events: LockWaitEvent[] = [];

    const promise = withLocaleWriteLock("/proj", "de", fs, async () => {}, {
      pollIntervalMs: 50,
      acquireTimeoutMs: 5_000,
      onWait: (event) => events.push(event),
    });
    await vi.advanceTimersByTimeAsync(100);
    await expect(promise).resolves.toBeUndefined();

    expect(events).toHaveLength(1);
    expect(events[0]?.holder).toBeUndefined();
    expect(events[0]?.lockPath).toBe(localeLockPath("/proj", "de"));
  });

  it("still invokes onWait, without holder fields, when the payload is valid JSON but not an object", async () => {
    vi.useFakeTimers();
    const fs = makeContendedFs(1, async () => ({ kind: "ok", content: "42" }));
    const events: LockWaitEvent[] = [];

    const promise = withLocaleWriteLock("/proj", "de", fs, async () => {}, {
      pollIntervalMs: 50,
      acquireTimeoutMs: 5_000,
      onWait: (event) => events.push(event),
    });
    await vi.advanceTimersByTimeAsync(100);
    await promise;

    expect(events).toHaveLength(1);
    expect(events[0]?.holder).toBeUndefined();
  });

  it("still invokes onWait, without holder fields, when the lock file cannot be read", async () => {
    vi.useFakeTimers();
    const fs = makeContendedFs(1, async () => ({ kind: "missing" }));
    const events: LockWaitEvent[] = [];

    const promise = withLocaleWriteLock("/proj", "de", fs, async () => {}, {
      pollIntervalMs: 50,
      acquireTimeoutMs: 5_000,
      onWait: (event) => events.push(event),
    });
    await vi.advanceTimersByTimeAsync(100);
    await promise;

    expect(events).toHaveLength(1);
    expect(events[0]?.holder).toBeUndefined();
  });

  it("carries only the fields present in a partial payload (pid without acquiredAt)", async () => {
    vi.useFakeTimers();
    const fs = makeContendedFs(1, async () => ({
      kind: "ok",
      content: JSON.stringify({ pid: 5 }),
    }));
    const events: LockWaitEvent[] = [];

    const promise = withLocaleWriteLock("/proj", "de", fs, async () => {}, {
      pollIntervalMs: 50,
      acquireTimeoutMs: 5_000,
      onWait: (event) => events.push(event),
    });
    await vi.advanceTimersByTimeAsync(100);
    await promise;

    expect(events[0]?.holder).toEqual({ pid: 5 });
  });

  it("invokes onWait periodically while waiting, with a non-decreasing elapsed time", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const fs = makeFakeFs({ createExclusive: async (): Promise<boolean> => false });
    const events: LockWaitEvent[] = [];

    const promise = withLocaleWriteLock("/proj", "de", fs, async () => {}, {
      pollIntervalMs: 100,
      acquireTimeoutMs: 3_500,
      onWait: (event) => events.push(event),
    }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(3_600);
    const error = await promise;

    expect(error).toBeInstanceOf(SdkError);
    expect((error as SdkError).code).toBe("LOCK_CONTENDED");
    const elapsed = events.map((event) => event.elapsedMs);
    expect(new Set(elapsed).size).toBeGreaterThanOrEqual(3);
    expect(elapsed).toEqual([...elapsed].sort((a, b) => a - b));
    expect(events.length).toBeLessThanOrEqual(5);
    const gaps = elapsed.slice(1).map((ms, index) => ms - (elapsed[index] ?? 0));
    for (const gap of gaps) {
      expect(gap).toBeGreaterThanOrEqual(1_000);
    }
  });

  it("never invokes onWait on an uncontended acquire", async () => {
    const fs = makeFakeFs();
    const events: LockWaitEvent[] = [];

    await withLocaleWriteLock("/proj", "de", fs, async () => {}, {
      onWait: (event) => events.push(event),
    });

    expect(events).toHaveLength(0);
  });
});
