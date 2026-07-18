import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { type LockWaitEvent, localeLockPath } from "../lock/locale-write-lock.js";
import { baseConfig, makeStubProvider, makeTempDir, writeJsonFile } from "../test-support.js";
import type { LocaleSummary } from "./summary.js";
import { translate } from "./translate-project.js";

function localeSummary(locales: readonly LocaleSummary[], locale: string): LocaleSummary {
  const summary = locales.find((entry) => entry.locale === locale);
  if (summary === undefined) {
    throw new Error(`no summary for locale ${locale}`);
  }
  return summary;
}

/** Pre-create a held locale lock file on disk so the run's own acquire contends against it. */
async function holdLock(dir: string, locale: string, pid: number): Promise<string> {
  const path = localeLockPath(dir, locale);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify({ pid, acquiredAt: "2026-07-18T00:00:00.000Z" }), "utf8");
  return path;
}

describe("translate: onLockWait and lockAcquireTimeoutMs thread through to the locale write lock", () => {
  it("surfaces wait progress and fails the contended locale fast under the override timeout", async () => {
    const dir = await makeTempDir();
    await mkdir(join(dir, "locales"));
    await writeJsonFile(join(dir, "locales", "en.json"), { greeting: "Hello" });
    const lockPath = await holdLock(dir, "de", 9999);
    const config = baseConfig({ targetLocales: ["de"] });
    const { provider } = makeStubProvider();

    const events: LockWaitEvent[] = [];
    const summary = await translate(
      {
        config,
        cwd: dir,
        onLockWait: (event) => events.push(event),
        lockAcquireTimeoutMs: 50,
      },
      { createProvider: () => provider },
    );

    const de = localeSummary(summary.locales, "de");
    expect(de.status).toBe("failed");
    expect(de.error?.code).toBe("LOCK_CONTENDED");
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]).toMatchObject({ lockPath, holder: { pid: 9999 } });
  });
});
