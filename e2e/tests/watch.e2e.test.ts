import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  type Consumer,
  makeConsumer,
  pollUntil,
  providerConfigBlock,
  providerFromEnv,
  readJsonIn,
  type Subprocess,
  spawnVerbatra,
  writeFileIn,
  writeJsonIn,
} from "../src/harness.js";

const provider = providerFromEnv();

describe.skipIf(provider === null)(`watch (live: ${provider?.id ?? "skipped"})`, () => {
  let consumer: Consumer;

  beforeAll(async () => {
    consumer = await makeConsumer();
  }, 180_000);

  it("translates on startup and again when the source changes, then stops on interrupt", async () => {
    if (provider === null) {
      return;
    }
    const dir = join(consumer.dir, "watch-live");
    await mkdir(dir, { recursive: true });
    await writeJsonIn(dir, "locales/en.json", {
      greeting: "Hello {{name}}",
      farewell: "Goodbye",
    });
    await writeJsonIn(dir, "locales/de.json", { greeting: "Hallo {{name}}" });
    await writeFileIn(
      dir,
      "verbatra.config.ts",
      `import { defineConfig } from "@verbatra/cli";\n\nexport default defineConfig({\n  sourceLocale: "en",\n  targetLocales: ["de"],\n  format: "i18next-json",\n  files: { pattern: "locales/{locale}.json" },\n  provider: ${providerConfigBlock(provider)},\n});\n`,
    );

    const watcher: Subprocess = spawnVerbatra(consumer, ["watch", "--json", "--cwd", dir], {
      env: { [provider.envVar]: provider.key },
    });
    let stopResult: Awaited<Subprocess> | undefined;

    try {
      // The startup run fills the missing key; reaching it also proves the watcher is live.
      await pollUntil(
        async () => {
          const de = await readJsonIn<Record<string, string>>(dir, "locales/de.json");
          return typeof de.farewell === "string" && de.farewell.length > 0;
        },
        { timeoutMs: 90_000, intervalMs: 1000 },
      );

      await writeJsonIn(dir, "locales/en.json", {
        greeting: "Hello {{name}}",
        farewell: "Goodbye",
        welcome: "Welcome {{name}}",
      });
      await pollUntil(
        async () => {
          const de = await readJsonIn<Record<string, string>>(dir, "locales/de.json");
          return typeof de.welcome === "string" && de.welcome.length > 0;
        },
        { timeoutMs: 90_000, intervalMs: 1000 },
      );

      const de = await readJsonIn<Record<string, string>>(dir, "locales/de.json");
      expect((de.farewell ?? "").length).toBeGreaterThan(0);
      expect(de.welcome ?? "").toContain("{{name}}");
      expect(de.greeting ?? "").toContain("{{name}}");
    } finally {
      // Cleanup runs whether the assertions above passed or failed, so a stuck watcher never
      // outlives the test.
      watcher.kill("SIGINT");
      stopResult = await watcher;
    }

    // A single SIGINT is the documented graceful-stop contract: exit 0, having already emitted at
    // least one NDJSON record to stdout, with no secret in either stream. Asserted only once the
    // watch/translate flow above has already succeeded, so a translate failure is never masked by
    // a shutdown assertion.
    expect(stopResult?.signal).toBeUndefined();
    expect(stopResult?.exitCode).toBe(0);

    const records = (stopResult?.stdout ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as { status: string });
    expect(records.length).toBeGreaterThan(0);

    expect(stopResult?.stdout).not.toContain(provider.key);
    expect(stopResult?.stderr).not.toContain(provider.key);
  }, 240_000);
});
