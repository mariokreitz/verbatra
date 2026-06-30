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

    try {
      // Phase 1: the initial run on startup fills the key that is already missing. Reaching this
      // point also proves the file watcher is live for phase 2.
      await pollUntil(
        async () => {
          const de = await readJsonIn<Record<string, string>>(dir, "locales/de.json");
          return typeof de.farewell === "string" && de.farewell.length > 0;
        },
        { timeoutMs: 90_000, intervalMs: 1000 },
      );

      // Phase 2: a source edit after startup triggers a re-translation of just the new key.
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
      // The placeholder survives the re-translation.
      expect(de.welcome ?? "").toContain("{{name}}");
      expect(de.greeting ?? "").toContain("{{name}}");
    } finally {
      watcher.kill("SIGINT");
      await watcher;
    }
  }, 240_000);
});
