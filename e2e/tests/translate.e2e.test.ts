import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  type Consumer,
  makeConsumer,
  providerConfigBlock,
  providerFromEnv,
  readJsonIn,
  runVerbatra,
  writeFileIn,
  writeJsonIn,
} from "../src/harness.js";

const provider = providerFromEnv();

describe.skipIf(provider === null)(`translate (live: ${provider?.id ?? "skipped"})`, () => {
  let consumer: Consumer;

  beforeAll(async () => {
    consumer = await makeConsumer();
  }, 180_000);

  it("translates the missing key and leaves the project in sync", async () => {
    if (provider === null) {
      return;
    }
    const dir = join(consumer.dir, "translate-live");
    await mkdir(dir, { recursive: true });
    await writeFileIn(
      dir,
      "verbatra.config.ts",
      `import { defineConfig } from "@verbatra/cli";\n\nexport default defineConfig({\n  sourceLocale: "en",\n  targetLocales: ["de"],\n  format: "i18next-json",\n  files: { pattern: "locales/{locale}.json" },\n  provider: ${providerConfigBlock(provider)},\n});\n`,
    );
    await writeJsonIn(dir, "locales/en.json", {
      greeting: "Hello {{name}}",
      farewell: "Goodbye",
    });
    await writeJsonIn(dir, "locales/de.json", { greeting: "Hallo {{name}}" });

    const translated = await runVerbatra(consumer, ["translate", "--json", "--cwd", dir], {
      env: { [provider.envVar]: provider.key },
    });
    expect(translated.exitCode).toBe(0);

    // The previously missing key now exists and keeps the placeholder intact.
    const de = await readJsonIn<Record<string, string>>(dir, "locales/de.json");
    const farewell = de.farewell ?? "";
    expect(farewell.length).toBeGreaterThan(0);
    expect(de.greeting ?? "").toContain("{{name}}");

    // A follow-up check now reports the project in sync.
    const checked = await runVerbatra(consumer, ["check", "--cwd", dir]);
    expect(checked.exitCode).toBe(0);
  });
});
