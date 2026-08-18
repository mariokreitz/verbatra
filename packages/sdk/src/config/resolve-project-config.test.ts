import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SdkError } from "../errors.js";
import { makeTempDir, makeTreeFs } from "../test-support.js";
import { requireDetectedProvider, resolveProjectConfig } from "./resolve-project-config.js";

const ROOT = "/project";

const DETECTABLE = {
  "package.json": JSON.stringify({ dependencies: { i18next: "^25.0.0" } }),
  "locales/en.json": "{}",
  "locales/de.json": "{}",
} as const;

const AUTHORED_CONFIG = JSON.stringify({
  sourceLocale: "en",
  targetLocales: ["ja"],
  format: "next-intl-json",
  files: { pattern: "custom/{locale}.json" },
  provider: { id: "deepl", options: {} },
});

describe("resolveProjectConfig: an authored config always wins", () => {
  it("uses a real config file and never detects", async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, ".verbatrarc.json"), AUTHORED_CONFIG);
    await mkdir(join(dir, "locales"), { recursive: true });
    await writeFile(join(dir, "locales", "en.json"), "{}");
    await writeFile(join(dir, "locales", "de.json"), "{}");

    const resolved = await resolveProjectConfig({ cwd: dir });

    expect(resolved.detection).toBeUndefined();
    expect(resolved.loaded?.source.kind).toBe("search");
    expect(resolved.config.format).toBe("next-intl-json");
    expect(resolved.config.targetLocales).toEqual(["ja"]);
    expect(resolved.config.files.pattern).toBe("custom/{locale}.json");
  });

  it("uses a config override without touching the file system", async () => {
    const resolved = await resolveProjectConfig({
      cwd: ROOT,
      fs: makeTreeFs(ROOT, DETECTABLE),
      configOverride: JSON.parse(AUTHORED_CONFIG) as unknown,
    });

    expect(resolved.detection).toBeUndefined();
    expect(resolved.loaded?.source.kind).toBe("override");
  });

  it("keeps a missing explicit configPath an error rather than detecting around it", async () => {
    const error = await resolveProjectConfig({
      cwd: ROOT,
      fs: makeTreeFs(ROOT, DETECTABLE),
      configPath: "nope.config.ts",
    }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(SdkError);
    expect((error as SdkError).code).toBe("CONFIG_NOT_FOUND");
  });
});

describe("resolveProjectConfig: detection fallback", () => {
  it("synthesizes a config when no config file exists", async () => {
    const resolved = await resolveProjectConfig({
      cwd: ROOT,
      fs: makeTreeFs(ROOT, DETECTABLE),
      env: { ANTHROPIC_API_KEY: "secret" },
    });

    expect(resolved.loaded).toBeUndefined();
    expect(resolved.detection?.format).toBe("i18next-json");
    expect(resolved.config.sourceLocale).toBe("en");
    expect(resolved.config.targetLocales).toEqual(["de"]);
  });

  it("keeps the plain CONFIG_NOT_FOUND failure when detection is switched off", async () => {
    const error = await resolveProjectConfig({
      cwd: ROOT,
      fs: makeTreeFs(ROOT, DETECTABLE),
      detect: false,
    }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(SdkError);
    expect((error as SdkError).code).toBe("CONFIG_NOT_FOUND");
  });

  it("surfaces a detection failure rather than the config-not-found one", async () => {
    const error = await resolveProjectConfig({
      cwd: ROOT,
      fs: makeTreeFs(ROOT, { "src/index.ts": "export {};" }),
    }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(SdkError);
    expect((error as SdkError).code).toBe("PROJECT_NOT_DETECTED");
  });
});

describe("requireDetectedProvider", () => {
  it("passes a detected project that found an API key", async () => {
    const resolved = await resolveProjectConfig({
      cwd: ROOT,
      fs: makeTreeFs(ROOT, DETECTABLE),
      env: { OPENAI_API_KEY: "secret" },
    });

    expect(() => {
      requireDetectedProvider(resolved);
    }).not.toThrow();
  });

  it("refuses a detected project with no API key, naming every variable", async () => {
    const resolved = await resolveProjectConfig({
      cwd: ROOT,
      fs: makeTreeFs(ROOT, DETECTABLE),
      env: {},
    });

    try {
      requireDetectedProvider(resolved);
      expect.unreachable("expected a PROVIDER_KEY_MISSING failure");
    } catch (error) {
      expect(error).toBeInstanceOf(SdkError);
      expect((error as SdkError).code).toBe("PROVIDER_KEY_MISSING");
      expect((error as SdkError).message).toContain("ANTHROPIC_API_KEY");
      expect((error as SdkError).message).toContain("OPENAI_API_KEY");
      expect((error as SdkError).message).toContain("GEMINI_API_KEY");
      expect((error as SdkError).message).toContain("DEEPL_API_KEY");
    }
  });

  it("never refuses an authored config, which names its provider deliberately", async () => {
    const resolved = await resolveProjectConfig({
      cwd: ROOT,
      fs: makeTreeFs(ROOT, DETECTABLE),
      configOverride: JSON.parse(AUTHORED_CONFIG) as unknown,
      env: {},
    });

    expect(() => {
      requireDetectedProvider(resolved);
    }).not.toThrow();
  });
});
