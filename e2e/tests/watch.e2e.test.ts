import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  type Consumer,
  makeConsumer,
  parseNdjsonLines,
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

  /**
   * The shutdown assertions (exit 0 on a single SIGINT, at least one NDJSON record, no secret in
   * either stream) run only after the watch/translate flow has already succeeded, so a translate
   * failure is never masked by a shutdown assertion.
   */
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
      watcher.kill("SIGINT");
      stopResult = await watcher;
    }

    expect(stopResult.signal).toBeUndefined();
    expect(stopResult.exitCode).toBe(0);

    const records = parseNdjsonLines(stopResult.stdout);
    expect(records.length).toBeGreaterThan(0);

    expect(stopResult.stdout).not.toContain(provider.key);
    expect(stopResult.stderr).not.toContain(provider.key);
  }, 240_000);
});
