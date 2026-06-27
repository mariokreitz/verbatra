import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SdkError } from "../errors.js";
import { baseConfig, makeTempDir } from "../test-support.js";
import type { AuthoringConfig } from "./authoring.js";
import { defineConfig } from "./define-config.js";
import { loadConfig } from "./load-config.js";

describe("loadConfig", () => {
  it("loads and validates a file-based .verbatrarc.json", async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, ".verbatrarc.json"), JSON.stringify(baseConfig()), "utf8");
    const config = await loadConfig({ cwd: dir });
    expect(config.sourceLocale).toBe("en");
    expect(config.format).toBe("i18next-json");
  });

  it("loads a code-defined verbatra.config.ts via the TypeScript loader", async () => {
    const dir = await makeTempDir();
    const cfg = baseConfig({ sourceLocale: "en", targetLocales: ["fr"] });
    await writeFile(
      join(dir, "verbatra.config.ts"),
      `export default ${JSON.stringify(cfg)};`,
      "utf8",
    );
    const config = await loadConfig({ cwd: dir });
    expect(config.targetLocales).toEqual(["fr"]);
  });

  it("loads a package.json 'verbatra' property", async () => {
    const dir = await makeTempDir();
    await writeFile(
      join(dir, "package.json"),
      JSON.stringify({ name: "tmp", version: "0.0.0", verbatra: baseConfig() }),
      "utf8",
    );
    const config = await loadConfig({ cwd: dir });
    expect(config.sourceLocale).toBe("en");
  });

  it("first-found-wins: package.json precedes .verbatrarc.json", async () => {
    const dir = await makeTempDir();
    await writeFile(
      join(dir, "package.json"),
      JSON.stringify({
        name: "tmp",
        version: "0.0.0",
        verbatra: baseConfig({ sourceLocale: "en" }),
      }),
      "utf8",
    );
    await writeFile(
      join(dir, ".verbatrarc.json"),
      JSON.stringify(baseConfig({ sourceLocale: "xx" })),
      "utf8",
    );
    const config = await loadConfig({ cwd: dir });
    expect(config.sourceLocale).toBe("en");
  });

  it("a missing config is CONFIG_NOT_FOUND", async () => {
    const dir = await makeTempDir();
    await expect(loadConfig({ cwd: dir })).rejects.toMatchObject({ code: "CONFIG_NOT_FOUND" });
  });

  it("an invalid config is a structured CONFIG_INVALID, not a raw zod throw", async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, ".verbatrarc.json"), JSON.stringify({ sourceLocale: "en" }), "utf8");
    const error = await loadConfig({ cwd: dir }).catch((e) => e);
    expect(error).toBeInstanceOf(SdkError);
    expect((error as SdkError).code).toBe("CONFIG_INVALID");
  });

  it("rejects a stray top-level key (no key field allowed in config)", async () => {
    const withKey = { ...baseConfig(), apiKey: "should-not-be-here" };
    await expect(loadConfig({ configOverride: withKey })).rejects.toMatchObject({
      code: "CONFIG_INVALID",
    });
  });

  it("validates a configOverride without touching the file system", async () => {
    const config = await loadConfig({
      configOverride: baseConfig({ targetLocales: ["de", "fr"] }),
    });
    expect(config.targetLocales).toEqual(["de", "fr"]);
  });

  it("rejects an unknown provider id through the discriminated union", async () => {
    const bad = { ...baseConfig(), provider: { id: "bogus", options: {} } };
    await expect(loadConfig({ configOverride: bad })).rejects.toMatchObject({
      code: "CONFIG_INVALID",
    });
  });

  it("rejects a stray apiKey in provider options with a secret-free, env-teaching error", async () => {
    const bad = {
      ...baseConfig(),
      provider: {
        id: "anthropic",
        options: { model: "m", maxTokens: 1, apiKey: "SECRET-VALUE-xyz" },
      },
    };
    const caught = await loadConfig({ configOverride: bad }).catch((e) => e);
    expect(caught).toBeInstanceOf(SdkError);
    const error = caught as SdkError;
    expect(error.code).toBe("CONFIG_INVALID");
    expect(error.message).toContain("apiKey");
    expect(error.message).not.toContain("SECRET-VALUE-xyz");
    expect(error.message.toLowerCase()).toContain("environment");
  });

  it("a config file that throws while loading is a structured CONFIG_INVALID", async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, "verbatra.config.ts"), "export default {{{ invalid", "utf8");
    await expect(loadConfig({ cwd: dir })).rejects.toMatchObject({ code: "CONFIG_INVALID" });
  });

  it("defineConfig returns its argument unchanged", () => {
    // The cast feeds a runtime-shaped value through an identity helper whose parameter restricts model to a provider's known literals.
    const cfg = baseConfig();
    expect(defineConfig(cfg as AuthoringConfig)).toBe(cfg);
  });

  it("accepts an optional boolean prune option", async () => {
    const on = await loadConfig({ configOverride: { ...baseConfig(), prune: true } });
    expect(on.prune).toBe(true);
    const off = await loadConfig({ configOverride: { ...baseConfig(), prune: false } });
    expect(off.prune).toBe(false);
    const absent = await loadConfig({ configOverride: baseConfig() });
    expect(absent.prune).toBeUndefined();
  });

  it("rejects a non-boolean prune option", async () => {
    const bad = { ...baseConfig(), prune: "yes" };
    await expect(loadConfig({ configOverride: bad })).rejects.toMatchObject({
      code: "CONFIG_INVALID",
    });
  });

  it("accepts a positive-integer maxBatchSize and loads it unchanged", async () => {
    const config = await loadConfig({ configOverride: { ...baseConfig(), maxBatchSize: 25 } });
    expect(config.maxBatchSize).toBe(25);
  });

  it("leaves maxBatchSize undefined when absent so the consumer applies the default", async () => {
    const config = await loadConfig({ configOverride: baseConfig() });
    expect(config.maxBatchSize).toBeUndefined();
  });

  it("rejects a non-positive, non-integer, or non-number maxBatchSize as CONFIG_INVALID", async () => {
    for (const value of [0, -5, 1.5, "10"]) {
      const bad = { ...baseConfig(), maxBatchSize: value };
      await expect(loadConfig({ configOverride: bad })).rejects.toMatchObject({
        code: "CONFIG_INVALID",
      });
    }
  });
});
