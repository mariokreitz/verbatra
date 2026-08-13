import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  type Consumer,
  makeConsumer,
  readJsonIn,
  runVerbatra,
  writeJsonIn,
} from "../src/harness.js";

let consumer: Consumer;

const config = {
  sourceLocale: "en",
  targetLocales: ["de", "fr"],
  format: "i18next-json",
  files: { pattern: "locales/{locale}.json" },
  provider: { id: "anthropic", options: { model: "claude-sonnet-4-6", maxTokens: 4096 } },
};

async function seedMultiLocale(name: string, extra: Record<string, unknown> = {}): Promise<string> {
  const dir = join(consumer.dir, name);
  await mkdir(dir, { recursive: true });
  await writeJsonIn(dir, ".verbatrarc.json", { ...config, ...extra });
  await writeJsonIn(dir, "locales/en.json", { greeting: "Hello {{name}}", farewell: "Goodbye" });
  await writeJsonIn(dir, "locales/de.json", { greeting: "Hallo {{name}}" });
  await writeJsonIn(dir, "locales/fr.json", { greeting: "Bonjour {{name}}" });
  return dir;
}

beforeAll(async () => {
  consumer = await makeConsumer();
}, 180_000);

describe("translate --dry-run --concurrency 2 (no provider)", () => {
  it("exits 0, writes nothing, prints progress to stderr while stdout stays the dry-run summary", async () => {
    const dir = await seedMultiLocale("dry-run-concurrency");
    const result = await runVerbatra(
      consumer,
      ["translate", "--dry-run", "--concurrency", "2", "--cwd", dir],
      { env: { ANTHROPIC_API_KEY: "" } },
    );

    expect(result.exitCode).toBe(0);

    expect(result.stderr).toMatch(/translating/);
    expect(result.stderr).toMatch(/run finished/);

    expect(result.stdout).not.toMatch(/^verbatra: /m);
    expect(result.stdout).toContain("(dry run: nothing written)");

    const de = await readJsonIn<Record<string, string>>(dir, "locales/de.json");
    const fr = await readJsonIn<Record<string, string>>(dir, "locales/fr.json");
    expect(de.farewell).toBeUndefined();
    expect(fr.farewell).toBeUndefined();
  });
});

describe("translate --no-cache --dry-run (no provider)", () => {
  it("accepts --no-cache end to end and exits 0", async () => {
    const dir = await seedMultiLocale("no-cache-dry-run");
    const result = await runVerbatra(
      consumer,
      ["translate", "--no-cache", "--dry-run", "--cwd", dir],
      { env: { ANTHROPIC_API_KEY: "" } },
    );
    expect(result.exitCode).toBe(0);
  });
});

describe("translate --concurrency 2 with a token budget (no provider key)", () => {
  it("exits 2 on the budget guard before any provider construction, never on a missing key", async () => {
    const dir = await seedMultiLocale("concurrency-budget-conflict", { maxTokens: 4096 });
    const result = await runVerbatra(consumer, ["translate", "--concurrency", "2", "--cwd", dir], {
      env: { ANTHROPIC_API_KEY: "" },
    });

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("CONCURRENCY_BUDGET_CONFLICT");
    expect(result.stderr).not.toMatch(/API_KEY/);
  });
});
