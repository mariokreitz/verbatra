import { mkdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  type Consumer,
  makeConsumer,
  runVerbatra,
  writeFileIn,
  writeJsonIn,
} from "../src/harness.js";

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
