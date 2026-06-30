import { mkdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it } from "vitest";
import {
  type Consumer,
  makeConsumer,
  readJsonIn,
  runVerbatra,
  writeFileIn,
  writeJsonIn,
} from "../src/harness.js";

// Workbook layout, mirrored from @verbatra/exchange: data rows start after the header, and the
// editable target sits in the Translation column. The non-locale Instructions sheet is skipped.
const HEADER_ROW = 1;
const TRANSLATION_COLUMN = 5;
const INSTRUCTIONS_SHEET = "Instructions";

let consumer: Consumer;

const i18nextConfig = {
  sourceLocale: "en",
  targetLocales: ["de"],
  format: "i18next-json",
  files: { pattern: "locales/{locale}.json" },
  provider: { id: "anthropic", options: { model: "claude-sonnet-4-6", maxTokens: 4096 } },
};

async function seedProject(
  name: string,
  config: unknown,
  locales: Record<string, unknown>,
): Promise<string> {
  const dir = join(consumer.dir, name);
  await mkdir(dir, { recursive: true });
  await writeJsonIn(dir, ".verbatrarc.json", config);
  for (const [file, value] of Object.entries(locales)) {
    await writeJsonIn(dir, file, value);
  }
  return dir;
}

beforeAll(async () => {
  consumer = await makeConsumer();
}, 180_000);

describe("packaging", () => {
  it("installs the verbatra binary and responds to --help", async () => {
    const result = await runVerbatra(consumer, ["--help"]);
    expect(result.exitCode).toBe(0);
    for (const command of ["translate", "watch", "check", "diff", "export", "import", "init"]) {
      expect(result.stdout).toContain(command);
    }
  });
});

describe("check (read-only, no provider)", () => {
  it("exits 1 and counts the missing key when a target locale is behind", async () => {
    const dir = await seedProject("check-missing", i18nextConfig, {
      "locales/en.json": { greeting: "Hello {{name}}", farewell: "Goodbye" },
      "locales/de.json": { greeting: "Hallo {{name}}" },
    });
    const result = await runVerbatra(consumer, ["check", "--json", "--cwd", dir]);
    expect(result.exitCode).toBe(1);
    const summary = JSON.parse(result.stdout) as {
      inSync: boolean;
      locales: { locale: string; missing: number }[];
    };
    expect(summary.inSync).toBe(false);
    const de = summary.locales.find((entry) => entry.locale === "de");
    expect(de?.missing).toBe(1);
  });

  it("exits 0 when every target locale is in sync", async () => {
    const dir = await seedProject("check-synced", i18nextConfig, {
      "locales/en.json": { greeting: "Hello {{name}}" },
      "locales/de.json": { greeting: "Hallo {{name}}" },
    });
    const result = await runVerbatra(consumer, ["check", "--cwd", dir]);
    expect(result.exitCode).toBe(0);
  });
});

describe("diff (read-only, no provider)", () => {
  it("exits 1 and lists the key that would be added", async () => {
    const dir = await seedProject("diff-pending", i18nextConfig, {
      "locales/en.json": { greeting: "Hello {{name}}", farewell: "Goodbye" },
      "locales/de.json": { greeting: "Hallo {{name}}" },
    });
    const result = await runVerbatra(consumer, ["diff", "--json", "--cwd", dir]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("farewell");
  });
});

describe("export (read-only, no provider)", () => {
  it("writes a workbook of untranslated strings", async () => {
    const dir = await seedProject("export-wb", i18nextConfig, {
      "locales/en.json": { greeting: "Hello {{name}}", farewell: "Goodbye" },
      "locales/de.json": { greeting: "Hallo {{name}}" },
    });
    const out = join(dir, "verbatra-translations.xlsx");
    const result = await runVerbatra(consumer, ["export", "--out", out, "--cwd", dir]);
    expect(result.exitCode).toBe(0);
    const { size } = await stat(out);
    expect(size).toBeGreaterThan(0);
  });
});

describe("translate --dry-run (no provider)", () => {
  it("previews the missing key without a key, a provider call, or a write", async () => {
    const dir = await seedProject("translate-dry-run", i18nextConfig, {
      "locales/en.json": { greeting: "Hello {{name}}", farewell: "Goodbye" },
      "locales/de.json": { greeting: "Hallo {{name}}" },
    });
    // No ANTHROPIC_API_KEY is set; dry-run must still succeed because it never builds the provider.
    const result = await runVerbatra(consumer, ["translate", "--dry-run", "--json", "--cwd", dir]);
    expect(result.exitCode).toBe(0);

    // The target file is untouched: the missing key is reported, not written.
    const de = await readJsonIn<Record<string, string>>(dir, "locales/de.json");
    expect(de.farewell).toBeUndefined();
  });
});

describe("export then import round-trip (no provider)", () => {
  it("applies a human-filled workbook back into the locale files", async () => {
    const dir = await seedProject("import-roundtrip", i18nextConfig, {
      "locales/en.json": { greeting: "Hello {{name}}", farewell: "Goodbye" },
      "locales/de.json": { greeting: "Hallo {{name}}" },
    });
    const workbookPath = join(dir, "verbatra-translations.xlsx");
    const exported = await runVerbatra(consumer, ["export", "--out", workbookPath, "--cwd", dir]);
    expect(exported.exitCode).toBe(0);

    // Fill every exported row the way a translator would, leaving the hidden source-hash column intact.
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(workbookPath);
    for (const sheet of workbook.worksheets) {
      if (sheet.name === INSTRUCTIONS_SHEET) {
        continue;
      }
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === HEADER_ROW) {
          return;
        }
        row.getCell(TRANSLATION_COLUMN).value = "Auf Wiedersehen";
      });
    }
    await workbook.xlsx.writeFile(workbookPath);

    const imported = await runVerbatra(consumer, ["import", workbookPath, "--cwd", dir]);
    expect(imported.exitCode).toBe(0);

    const de = await readJsonIn<Record<string, string>>(dir, "locales/de.json");
    expect(de.farewell).toBe("Auf Wiedersehen");
    expect(de.greeting).toContain("{{name}}");

    // With the imported translation in place the project reads back in sync.
    const checked = await runVerbatra(consumer, ["check", "--cwd", dir]);
    expect(checked.exitCode).toBe(0);
  });
});

describe("other formats (read-only, no provider)", () => {
  it("checks a YAML project", async () => {
    const dir = await seedProject(
      "yaml-check",
      { ...i18nextConfig, format: "yaml", files: { pattern: "locales/{locale}.yml" } },
      {},
    );
    await writeFileIn(dir, "locales/en.yml", "greeting: Hello {{name}}\nfarewell: Goodbye\n");
    await writeFileIn(dir, "locales/de.yml", "greeting: Hallo {{name}}\n");
    const result = await runVerbatra(consumer, ["check", "--json", "--cwd", dir]);
    expect(result.exitCode).toBe(1);
  });

  it("checks a Flutter ARB project", async () => {
    const dir = await seedProject(
      "arb-check",
      { ...i18nextConfig, format: "arb", files: { pattern: "lib/l10n/app_{locale}.arb" } },
      {},
    );
    await writeJsonIn(dir, "lib/l10n/app_en.arb", {
      "@@locale": "en",
      greeting: "Hello {name}",
      farewell: "Goodbye",
    });
    await writeJsonIn(dir, "lib/l10n/app_de.arb", { "@@locale": "de", greeting: "Hallo {name}" });
    const result = await runVerbatra(consumer, ["check", "--json", "--cwd", dir]);
    expect(result.exitCode).toBe(1);
  });
});

describe("init (no provider)", () => {
  it("scaffolds a config and env example for the chosen provider", async () => {
    const dir = join(consumer.dir, "init-scaffold");
    await mkdir(dir, { recursive: true });
    const result = await runVerbatra(consumer, [
      "init",
      "--yes",
      "--provider",
      "anthropic",
      "--source",
      "en",
      "--targets",
      "de,fr",
      "--cwd",
      dir,
    ]);
    expect(result.exitCode).toBe(0);

    const config = await readFile(join(dir, "verbatra.config.ts"), "utf8");
    expect(config).toContain("anthropic");
    expect(config).toContain("de");
    expect(config).toContain("fr");

    const envExample = await readFile(join(dir, ".env.example"), "utf8");
    expect(envExample).toContain("ANTHROPIC_API_KEY");
    expect(envExample).not.toMatch(/ANTHROPIC_API_KEY=.+\S/);
  });
});
