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
 * QA gap (a): the export now re-zips the workbook with a workbook-structure lock, and the read no
 * longer throws on a bad row. The existing round-trip e2e re-saves the workbook through exceljs before
 * import, which strips that injected lock, so no e2e imports the structure-locked artifact directly.
 * This test drives `verbatra import` on the exact protected file that `verbatra export` produced, with
 * no exceljs touch, proving the CLI import path opens the re-zipped, structure-locked workbook. The
 * cells are left unfilled, so import applies nothing and exits 0, and the target file is untouched.
 */

let consumer: Consumer;

const config = {
  sourceLocale: "en",
  targetLocales: ["de"],
  format: "i18next-json",
  files: { pattern: "locales/{locale}.json" },
  provider: { id: "anthropic", options: { model: "claude-sonnet-4-6", maxTokens: 4096 } },
};

beforeAll(async () => {
  consumer = await makeConsumer();
}, 180_000);

describe("import a structure-locked export directly (no exceljs re-save)", () => {
  it("opens the protected workbook the exporter wrote and exits 0 with nothing applied", async () => {
    const dir = join(consumer.dir, "structure-lock-import");
    await mkdir(dir, { recursive: true });
    await writeJsonIn(dir, ".verbatrarc.json", config);
    await writeJsonIn(dir, "locales/en.json", { greeting: "Hello {{name}}", farewell: "Goodbye" });
    await writeJsonIn(dir, "locales/de.json", { greeting: "Hallo {{name}}" });

    const workbookPath = join(dir, "verbatra-translations.xlsx");
    const exported = await runVerbatra(consumer, ["export", "--out", workbookPath, "--cwd", dir]);
    expect(exported.exitCode).toBe(0);

    // Import the exact bytes the exporter wrote: the workbookProtection lock is still present.
    const imported = await runVerbatra(consumer, ["import", workbookPath, "--cwd", dir]);
    expect(imported.exitCode).toBe(0);

    // Nothing was filled, so the target locale is unchanged and no new key appears.
    const de = await readJsonIn<Record<string, string>>(dir, "locales/de.json");
    expect(de.greeting).toBe("Hallo {{name}}");
    expect(de.farewell).toBeUndefined();
  });
});
