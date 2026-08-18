import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SdkError } from "../../errors.js";
import { makeFakeFs, makeTempDir, makeTreeFs } from "../../test-support.js";
import { detectProject } from "./detect-project.js";

const ROOT = "/project";

const I18NEXT_MANIFEST = JSON.stringify({ dependencies: { i18next: "^25.0.0" } });
const NEXT_INTL_MANIFEST = JSON.stringify({ dependencies: { "next-intl": "^4.0.0" } });

function detect(files: Readonly<Record<string, string>>, env: NodeJS.ProcessEnv = {}) {
  return detectProject({ cwd: ROOT, fs: makeTreeFs(ROOT, files), env });
}

async function detectError(
  files: Readonly<Record<string, string>>,
  env: NodeJS.ProcessEnv = {},
): Promise<SdkError> {
  const error = await detect(files, env).catch((thrown: unknown) => thrown);
  expect(error).toBeInstanceOf(SdkError);
  return error as SdkError;
}

describe("detectProject: layouts it accepts", () => {
  it("detects a flat i18next JSON layout", async () => {
    const { config, detection } = await detect({
      "package.json": I18NEXT_MANIFEST,
      "locales/en.json": "{}",
      "locales/de.json": "{}",
      "locales/fr.json": "{}",
    });

    expect(detection.directory).toBe("locales");
    expect(detection.pattern).toBe("locales/{locale}.json");
    expect(detection.format).toBe("i18next-json");
    expect(detection.sourceLocale).toBe("en");
    expect([...detection.targetLocales].sort()).toEqual(["de", "fr"]);
    expect(config.files.pattern).toBe("locales/{locale}.json");
  });

  it("detects a next-intl messages layout", async () => {
    const { detection } = await detect({
      "package.json": NEXT_INTL_MANIFEST,
      "messages/en.json": "{}",
      "messages/de.json": "{}",
    });

    expect(detection.directory).toBe("messages");
    expect(detection.format).toBe("next-intl-json");
  });

  it("detects a vue-i18n src/locales layout", async () => {
    const { detection } = await detect({
      "package.json": JSON.stringify({ dependencies: { "vue-i18n": "^11.0.0" } }),
      "src/locales/en.json": "{}",
      "src/locales/es.json": "{}",
    });

    expect(detection.pattern).toBe("src/locales/{locale}.json");
    expect(detection.format).toBe("vue-i18n-json");
  });

  it("detects a single-namespace nested layout", async () => {
    const { detection } = await detect({
      "package.json": I18NEXT_MANIFEST,
      "public/locales/en/common.json": "{}",
      "public/locales/de/common.json": "{}",
    });

    expect(detection.pattern).toBe("public/locales/{locale}/common.json");
    expect(detection.targetLocales).toEqual(["de"]);
  });

  it("detects a regional locale and keeps its spelling", async () => {
    const { detection } = await detect({
      "package.json": I18NEXT_MANIFEST,
      "locales/en.json": "{}",
      "locales/pt-BR.json": "{}",
    });

    expect(detection.pattern).toBe("locales/{locale}.json");
    expect(detection.targetLocales).toEqual(["pt-BR"]);
  });

  it("detects a locale embedded in a longer file name", async () => {
    const { detection } = await detect({
      "lib/l10n/app_en.arb": "{}",
      "lib/l10n/app_de.arb": "{}",
    });

    expect(detection.pattern).toBe("lib/l10n/app_{locale}.arb");
    expect(detection.format).toBe("arb");
  });

  it("resolves an extension-decisive format without any package.json", async () => {
    const { detection } = await detect({
      "config/locales/en.yml": "greeting: hi",
      "config/locales/de.yml": "greeting: hallo",
    });

    expect(detection.format).toBe("yaml");
  });

  it("prefers an exact en over a regional English locale as the source", async () => {
    const { detection } = await detect({
      "package.json": I18NEXT_MANIFEST,
      "locales/en-GB.json": "{}",
      "locales/en.json": "{}",
      "locales/de.json": "{}",
    });

    expect(detection.sourceLocale).toBe("en");
    expect([...detection.targetLocales].sort()).toEqual(["de", "en-GB"]);
  });

  it("falls back to a regional English locale when there is no plain en", async () => {
    const { detection } = await detect({
      "package.json": I18NEXT_MANIFEST,
      "locales/en-US.json": "{}",
      "locales/de.json": "{}",
    });

    expect(detection.sourceLocale).toBe("en-US");
  });

  it("reads a format declared only as a devDependency", async () => {
    const { detection } = await detect({
      "package.json": JSON.stringify({ devDependencies: { "@ngx-translate/core": "^17.0.0" } }),
      "src/assets/i18n/en.json": "{}",
      "src/assets/i18n/de.json": "{}",
    });

    expect(detection.format).toBe("ngx-translate-json");
  });

  it("detects a real project on disk through the default file system", async () => {
    const dir = await makeTempDir();
    await mkdir(join(dir, "locales"), { recursive: true });
    await writeFile(join(dir, "package.json"), I18NEXT_MANIFEST);
    await writeFile(join(dir, "locales", "en.json"), '{"greeting":"Hello"}');
    await writeFile(join(dir, "locales", "de.json"), '{"greeting":"Hallo"}');

    const { detection, config } = await detectProject({ cwd: dir });

    expect(detection.pattern).toBe("locales/{locale}.json");
    expect(detection.format).toBe("i18next-json");
    expect(config.sourceLocale).toBe("en");
    expect(config.targetLocales).toEqual(["de"]);
  });

  it("ignores files in the directory that carry no locale code", async () => {
    const { detection } = await detect({
      "package.json": I18NEXT_MANIFEST,
      "locales/README.md": "notes",
      "locales/en.json": "{}",
      "locales/de.json": "{}",
    });

    expect(detection.pattern).toBe("locales/{locale}.json");
  });
});

describe("detectProject: layouts it declines", () => {
  it("reports no detection when nothing looks like locale files", async () => {
    const error = await detectError({
      "package.json": I18NEXT_MANIFEST,
      "src/index.ts": "export {};",
    });

    expect(error.code).toBe("PROJECT_NOT_DETECTED");
    expect(error.message).toContain("verbatra init");
  });

  it("reports no detection for a single locale file", async () => {
    const error = await detectError({
      "package.json": I18NEXT_MANIFEST,
      "locales/en.json": "{}",
    });

    expect(error.code).toBe("PROJECT_NOT_DETECTED");
  });

  it("refuses to choose between two plausible locale directories", async () => {
    const error = await detectError({
      "package.json": I18NEXT_MANIFEST,
      "locales/en.json": "{}",
      "locales/de.json": "{}",
      "public/locales/en.json": "{}",
      "public/locales/de.json": "{}",
    });

    expect(error.code).toBe("PROJECT_AMBIGUOUS");
    expect(error.message).toContain("locales");
    expect(error.message).toContain("public/locales");
  });

  it("refuses a multi-namespace layout, which it cannot express", async () => {
    const error = await detectError({
      "package.json": I18NEXT_MANIFEST,
      "locales/en/common.json": "{}",
      "locales/en/home.json": "{}",
      "locales/de/common.json": "{}",
      "locales/de/home.json": "{}",
    });

    expect(error.code).toBe("PROJECT_LAYOUT_UNSUPPORTED");
    expect(error.message).toContain("one file per locale");
    expect(error.message).toContain("locales/{locale}/common.json");
    expect(error.message).toContain("locales/{locale}/home.json");
  });

  it("refuses a JSON layout whose format no dependency identifies", async () => {
    const error = await detectError({
      "package.json": JSON.stringify({ dependencies: { react: "^19.0.0" } }),
      "locales/en.json": "{}",
      "locales/de.json": "{}",
    });

    expect(error.code).toBe("PROJECT_NOT_DETECTED");
    expect(error.message).toContain("format");
  });

  it("refuses a JSON layout whose dependencies name two competing formats", async () => {
    const error = await detectError({
      "package.json": JSON.stringify({
        dependencies: { i18next: "^25.0.0", "next-intl": "^4.0.0" },
      }),
      "locales/en.json": "{}",
      "locales/de.json": "{}",
    });

    expect(error.code).toBe("PROJECT_NOT_DETECTED");
  });

  it("refuses a locale set with no English locale", async () => {
    const error = await detectError({
      "package.json": I18NEXT_MANIFEST,
      "locales/de.json": "{}",
      "locales/fr.json": "{}",
    });

    expect(error.code).toBe("PROJECT_NOT_DETECTED");
    expect(error.message).toContain("sourceLocale");
  });

  it("refuses a default-locale file that carries no locale code", async () => {
    const error = await detectError({
      "translations/messages.properties": "greeting=hi",
      "translations/messages_de.properties": "greeting=hallo",
    });

    expect(error.code).toBe("PROJECT_NOT_DETECTED");
  });

  it("reports a file system that cannot list directories", async () => {
    const error = await detectProject({ cwd: ROOT, fs: makeFakeFs(), env: {} }).catch(
      (thrown: unknown) => thrown,
    );

    expect(error).toBeInstanceOf(SdkError);
    expect((error as SdkError).code).toBe("PROJECT_NOT_DETECTED");
    expect((error as SdkError).message).toContain("readDirectory");
  });

  it("tolerates an unparseable package.json by falling through to a format failure", async () => {
    const error = await detectError({
      "package.json": "{ not json",
      "locales/en.json": "{}",
      "locales/de.json": "{}",
    });

    expect(error.code).toBe("PROJECT_NOT_DETECTED");
  });
});

describe("detectProject: provider selection", () => {
  const LAYOUT = {
    "package.json": I18NEXT_MANIFEST,
    "locales/en.json": "{}",
    "locales/de.json": "{}",
  } as const;

  it.each([
    ["ANTHROPIC_API_KEY", "anthropic"],
    ["OPENAI_API_KEY", "openai"],
    ["GEMINI_API_KEY", "gemini"],
    ["DEEPL_API_KEY", "deepl"],
  ])("selects %s as %s", async (variable, id) => {
    const { detection, config } = await detect(LAYOUT, { [variable]: "secret" });

    expect(detection.provider).toBe(id);
    expect(detection.providerResolved).toBe(true);
    expect(detection.alsoAvailable).toEqual([]);
    expect(config.provider.id).toBe(id);
  });

  it("applies the documented priority order when several keys are set", async () => {
    const { detection } = await detect(LAYOUT, {
      DEEPL_API_KEY: "secret",
      OPENAI_API_KEY: "secret",
      ANTHROPIC_API_KEY: "secret",
    });

    expect(detection.provider).toBe("anthropic");
    expect(detection.alsoAvailable).toEqual(["openai", "deepl"]);
  });

  it("ignores an empty key exactly as it ignores an unset one", async () => {
    const { detection } = await detect(LAYOUT, { ANTHROPIC_API_KEY: "", OPENAI_API_KEY: "secret" });

    expect(detection.provider).toBe("openai");
  });

  it("still detects the project when no key is set, flagging the provider as unresolved", async () => {
    const { detection, config } = await detect(LAYOUT);

    expect(detection.providerResolved).toBe(false);
    expect(config.sourceLocale).toBe("en");
    expect(config.provider.id).toBe("anthropic");
  });

  it("synthesizes provider options each provider's strict schema accepts", async () => {
    const anthropic = await detect(LAYOUT, { ANTHROPIC_API_KEY: "secret" });
    const openai = await detect(LAYOUT, { OPENAI_API_KEY: "secret" });
    const deepl = await detect(LAYOUT, { DEEPL_API_KEY: "secret" });

    expect(anthropic.config.provider.options).toHaveProperty("maxTokens");
    expect(openai.config.provider.options).toHaveProperty("maxOutputTokens");
    expect(deepl.config.provider.options).toEqual({});
  });
});
