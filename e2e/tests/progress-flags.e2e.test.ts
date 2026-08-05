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

/**
 * Keyless coverage for the progress, concurrency, and cache surface. Dry runs are budget-exempt and
 * never construct a provider, so they exercise --dry-run, --concurrency, and --no-cache without a
 * key. The live budget-guard case proves the concurrency-vs-budget refusal precedes provider
 * construction at the real CLI boundary: with the key blanked, a guard-first path fails on
 * CONCURRENCY_BUDGET_CONFLICT, while a provider-first path would instead name the missing key.
 */

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
  /**
   * The stream split is the point. Progress is rendered to stderr only (a per-locale "translating"
   * line and a run-finished line), while stdout stays the clean dry-run summary. Every progress
   * line carries the "verbatra: " prefix, so a stdout with no line starting that way is what proves
   * none of them leaked across. `farewell` is the key missing from both target locales, so its
   * continued absence afterwards is the proof the dry run wrote nothing.
   */
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
  /**
   * The API key is blanked deliberately. A missing-key failure would name the key's environment
   * variable, so the absence of any `API_KEY` mention in stderr is what proves the budget guard
   * refused the run before a provider was ever constructed.
   */
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
