import { access, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { ProviderError } from "@verbatra/ai-providers";
import { describe, expect, it } from "vitest";
import { localeLockPath } from "../lock/locale-write-lock.js";
import {
  baseConfig,
  makeStubProvider,
  makeTempDir,
  readJsonFile,
  writeJsonFile,
} from "../test-support.js";
import type { LocaleSummary } from "./summary.js";
import { translate } from "./translate-project.js";

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function localeSummary(locales: readonly LocaleSummary[], locale: string): LocaleSummary {
  const summary = locales.find((entry) => entry.locale === locale);
  if (summary === undefined) {
    throw new Error(`no summary for locale ${locale}`);
  }
  return summary;
}

describe("translate: a provider request that rejects releases the locale write lock", () => {
  it("frees the lock and withholds the key, so a subsequent run for the same locale translates it", async () => {
    const dir = await makeTempDir();
    await mkdir(join(dir, "locales"));
    await writeJsonFile(join(dir, "locales", "en.json"), { greeting: "Hello" });
    const config = baseConfig({ targetLocales: ["de"] });

    const timingOut = makeStubProvider({
      throwForLocales: new Set(["de"]),
      error: new ProviderError(
        "TIMEOUT",
        "The translation provider request exceeded the 120000 ms request timeout.",
      ),
    });
    const first = await translate(
      { config, cwd: dir },
      { createProvider: () => timingOut.provider },
    );

    expect(localeSummary(first.locales, "de").providerFailures).toContain("greeting");
    expect(await pathExists(localeLockPath(dir, "de"))).toBe(false);

    const succeeding = makeStubProvider();
    const second = await translate(
      { config, cwd: dir },
      { createProvider: () => succeeding.provider },
    );

    expect(second.failed).toEqual([]);
    const written = (await readJsonFile(join(dir, "locales", "de.json"))) as Record<string, string>;
    expect(written.greeting).toBe("[de] Hello");
  });
});
