import { mkdir, mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it } from "vitest";
import {
  type Consumer,
  makeConsumer,
  pollUntil,
  readJsonIn,
  runVerbatra,
  type Subprocess,
  spawnVerbatra,
  writeFileIn,
  writeJsonIn,
} from "../src/harness.js";

/** The `check --json` shape this suite asserts against; mirrors the SDK's `CheckSummary`. */
interface CheckSummaryJson {
  inSync: boolean;
  locales: { locale: string; missing: number }[];
}

// Column indices mirror @verbatra/exchange's fixed workbook layout.
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

  it("exposes the watch subcommand without needing a provider key", async () => {
    const result = await runVerbatra(consumer, ["watch", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("--debounce");
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
    const result = await runVerbatra(consumer, ["translate", "--dry-run", "--json", "--cwd", dir]);
    expect(result.exitCode).toBe(0);

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

    // Touch only the Translation column so the hidden source-hash column survives the round-trip.
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
    const summary = JSON.parse(result.stdout) as CheckSummaryJson;
    expect(summary.inSync).toBe(false);
    const de = summary.locales.find((entry) => entry.locale === "de");
    expect(de?.missing).toBe(1);
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
    const summary = JSON.parse(result.stdout) as CheckSummaryJson;
    expect(summary.inSync).toBe(false);
    const de = summary.locales.find((entry) => entry.locale === "de");
    // The "@@locale" key is ARB metadata, stripped before diffing, so only "farewell" is missing.
    expect(de?.missing).toBe(1);
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

describe("config errors (no provider)", () => {
  it("exits 2 with a config-not-found error when no config file is present", async () => {
    // A fresh temp directory outside the consumer tree, so cosmiconfig's upward search cannot pick
    // up any ambient config.
    const dir = await mkdtemp(join(tmpdir(), "verbatra-e2e-noconfig-"));
    const result = await runVerbatra(consumer, ["check", "--json", "--cwd", dir]);
    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toMatch(/\[CONFIG_NOT_FOUND\]/);
    expect(result.stderr).toContain("No verbatra configuration found");
  });
});

/** One line of the watch `--json` NDJSON output; a subset of the SDK's `WatchRunResult`. */
interface WatchRunResultJson {
  status: "succeeded" | "failed";
}

function parseNdjsonLines(stdout: string): WatchRunResultJson[] {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as WatchRunResultJson);
}

describe("watch SIGINT contract (no provider key needed)", () => {
  it("exits 0 on a single interrupt after emitting at least one NDJSON record", async () => {
    const dir = join(consumer.dir, "watch-sigint");
    await mkdir(dir, { recursive: true });
    await writeJsonIn(dir, "locales/en.json", { greeting: "Hello {{name}}" });
    await writeJsonIn(dir, "locales/de.json", { greeting: "Hallo {{name}}" });
    await writeFileIn(
      dir,
      "verbatra.config.ts",
      `import { defineConfig } from "@verbatra/cli";\n\nexport default defineConfig({\n  sourceLocale: "en",\n  targetLocales: ["de"],\n  format: "i18next-json",\n  files: { pattern: "locales/{locale}.json" },\n  provider: { id: "anthropic", options: { model: "claude-sonnet-4-6", maxTokens: 4096 } },\n});\n`,
    );

    // No API key: the initial run fails at provider construction (a structured, secret-free
    // ProviderError), but the watcher stays up. That is enough to exercise the SIGINT contract
    // without a live key: a single interrupt should still stop it cleanly with exit 0, having
    // already emitted one NDJSON record to stdout.
    const watcher: Subprocess = spawnVerbatra(consumer, ["watch", "--json", "--cwd", dir], {
      env: { ANTHROPIC_API_KEY: "" },
    });

    let stdoutBuf = "";
    watcher.stdout?.on("data", (chunk: Buffer) => {
      stdoutBuf += chunk.toString();
    });

    try {
      await pollUntil(() => stdoutBuf.trim().length > 0, { timeoutMs: 30_000, intervalMs: 250 });

      const records = parseNdjsonLines(stdoutBuf);
      expect(records.length).toBeGreaterThan(0);
      expect(records[0]?.status).toBe("failed");

      watcher.kill("SIGINT");
      const result = await watcher;
      expect(result.signal).toBeUndefined();
      expect(result.exitCode).toBe(0);
    } finally {
      // A no-op if the process already exited cleanly above; a safety net otherwise.
      watcher.kill("SIGKILL");
    }
  }, 45_000);
});

describe("runVerbatra signal-death (no provider key needed)", () => {
  it("reports a null exit code and the killing signal when the process is force-killed", async () => {
    const dir = join(consumer.dir, "watch-signal-death");
    await mkdir(dir, { recursive: true });
    await writeJsonIn(dir, "locales/en.json", { greeting: "Hello {{name}}" });
    await writeJsonIn(dir, "locales/de.json", { greeting: "Hallo {{name}}" });
    await writeFileIn(
      dir,
      "verbatra.config.ts",
      `import { defineConfig } from "@verbatra/cli";\n\nexport default defineConfig({\n  sourceLocale: "en",\n  targetLocales: ["de"],\n  format: "i18next-json",\n  files: { pattern: "locales/{locale}.json" },\n  provider: { id: "anthropic", options: { model: "claude-sonnet-4-6", maxTokens: 4096 } },\n});\n`,
    );

    // Without an API key, watch fails to construct a provider on startup but stays running (the
    // same behavior the SIGINT test above relies on), so it is still alive when the timeout
    // fires. This drives the signal-death path through runVerbatra itself, not spawnVerbatra:
    // runVerbatra fully awaits execa internally and never hands back a kill handle, so the only
    // way to reach a still-running child through it is to have execa force-kill it via its own
    // timeout option. SIGKILL cannot be caught by the CLI's SIGINT/SIGTERM shutdown handling, so
    // this is a real signal death, the same shape a crash or an OOM kill produces.
    const result = await runVerbatra(consumer, ["watch", "--json", "--cwd", dir], {
      env: { ANTHROPIC_API_KEY: "" },
      timeoutMs: 3000,
    });

    expect(result.exitCode).toBeNull();
    expect(result.signal).toBe("SIGKILL");
  }, 20_000);
});
