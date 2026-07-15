import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SDK_SRC = fileURLToPath(new URL("../", import.meta.url));

/**
 * The one file allowed to call `updateLockFileLocale` without also calling
 * `withLocaleWriteLock`: it is the definition site (the call inside its own doc comment and its
 * `export async function updateLockFileLocale(` declaration both match the substring below), and
 * its own internal concurrency guard is `withLockFileGuard`, a different, lower-level primitive.
 */
const DEFINITION_FILE = join(SDK_SRC, "lock", "lock-file.ts");

async function listSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter(
      (entry) => entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts"),
    )
    .map((entry) => join(entry.parentPath, entry.name));
}

/**
 * Static proof, mirroring `retranslate-entry.no-direct-env.test.ts`'s style, that no source file
 * calls `updateLockFileLocale` without also holding `withLocaleWriteLock` for the same critical
 * section: a future call site that forgets the lock would silently reopen the exact write race
 * this mechanism exists to close. Grep-based and deliberately coarse (it does not verify the two
 * calls nest correctly, only that both appear in the same file), matching how the codebase's other
 * static-grep guard tests work.
 */
describe("static proof: every updateLockFileLocale caller also holds withLocaleWriteLock", () => {
  it("holds for every non-test source file under packages/sdk/src", async () => {
    const files = await listSourceFiles(SDK_SRC);
    expect(files.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of files) {
      if (file === DEFINITION_FILE) {
        continue;
      }
      const content = await readFile(file, "utf8");
      if (content.includes("updateLockFileLocale(") && !content.includes("withLocaleWriteLock(")) {
        offenders.push(relative(SDK_SRC, file));
      }
    }

    expect(offenders).toEqual([]);
  });

  it("the definition file guards its own read-modify-write with withLockFileGuard", async () => {
    const content = await readFile(DEFINITION_FILE, "utf8");
    expect(content).toContain("updateLockFileLocale(");
    expect(content).toContain("withLockFileGuard(");
  });
});
