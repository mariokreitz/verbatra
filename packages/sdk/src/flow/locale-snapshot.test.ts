import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { VerbatraConfig } from "../config/schema.js";
import { baseConfig, makeTempDir, writeJsonFile } from "../test-support.js";
import {
  diffLocaleSnapshots,
  type LocaleFileSnapshot,
  readLocaleFileSnapshot,
} from "./locale-snapshot.js";

const cfg = (overrides: Partial<VerbatraConfig> = {}): VerbatraConfig =>
  baseConfig({ targetLocales: ["de"], format: "i18next-json", ...overrides });

async function project(files: Record<string, Record<string, unknown>>): Promise<string> {
  const dir = await makeTempDir();
  await mkdir(join(dir, "locales"));
  for (const [locale, obj] of Object.entries(files)) {
    await writeJsonFile(join(dir, "locales", `${locale}.json`), obj);
  }
  return dir;
}

describe("readLocaleFileSnapshot", () => {
  it("reads a content hash per key for an existing file", async () => {
    const dir = await project({ de: { a: "Aa", b: "Ba" } });
    const snapshot = await readLocaleFileSnapshot({ config: cfg(), locale: "de", cwd: dir });

    expect(snapshot.locale).toBe("de");
    expect([...snapshot.hashes.keys()].sort()).toEqual(["a", "b"]);
  });

  it("reads an empty snapshot for a locale file that does not exist yet, without throwing", async () => {
    const dir = await project({});
    const snapshot = await readLocaleFileSnapshot({ config: cfg(), locale: "de", cwd: dir });

    expect(snapshot).toEqual({ locale: "de", hashes: new Map() });
  });

  it("reads the configured source locale the same way as a target locale", async () => {
    const dir = await project({ en: { greeting: "hello" } });
    const snapshot = await readLocaleFileSnapshot({ config: cfg(), locale: "en", cwd: dir });

    expect(snapshot.locale).toBe("en");
    expect([...snapshot.hashes.keys()]).toEqual(["greeting"]);
  });

  it("gives two identically valued keys the same hash and two differently valued keys different hashes", async () => {
    const dir = await project({ de: { a: "same", b: "same", c: "different" } });
    const snapshot = await readLocaleFileSnapshot({ config: cfg(), locale: "de", cwd: dir });

    const a = snapshot.hashes.get("a");
    const b = snapshot.hashes.get("b");
    const c = snapshot.hashes.get("c");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("throws UNKNOWN_FORMAT when no adapter is registered for the format", async () => {
    const dir = await project({ de: { a: "Aa" } });
    await expect(
      readLocaleFileSnapshot({
        config: cfg({ format: "unknown-format" as VerbatraConfig["format"] }),
        locale: "de",
        cwd: dir,
      }),
    ).rejects.toMatchObject({ code: "UNKNOWN_FORMAT" });
  });

  it("defaults the working directory to process.cwd() when cwd is omitted", async () => {
    const dir = await project({ de: { a: "Aa" } });
    const previous = process.cwd();
    try {
      process.chdir(dir);
      const snapshot = await readLocaleFileSnapshot({ config: cfg(), locale: "de" });
      expect([...snapshot.hashes.keys()]).toEqual(["a"]);
    } finally {
      process.chdir(previous);
    }
  });
});

function snapshot(locale: string, entries: Readonly<Record<string, string>>): LocaleFileSnapshot {
  return { locale, hashes: new Map(Object.entries(entries)) };
}

describe("diffLocaleSnapshots", () => {
  it("reports zero counts when two identical snapshots are compared (no net delta)", () => {
    const previous = snapshot("de", { a: "h1", b: "h2" });
    const current = snapshot("de", { a: "h1", b: "h2" });

    expect(diffLocaleSnapshots(previous, current)).toEqual({ added: 0, changed: 0, removed: 0 });
  });

  it("counts a key present in current but absent from previous as added", () => {
    const previous = snapshot("de", { a: "h1" });
    const current = snapshot("de", { a: "h1", b: "h2" });

    expect(diffLocaleSnapshots(previous, current)).toEqual({ added: 1, changed: 0, removed: 0 });
  });

  it("counts a key present in previous but absent from current as removed", () => {
    const previous = snapshot("de", { a: "h1", b: "h2" });
    const current = snapshot("de", { a: "h1" });

    expect(diffLocaleSnapshots(previous, current)).toEqual({ added: 0, changed: 0, removed: 1 });
  });

  it("counts a key present in both with a different hash as changed (the value-only edit case)", () => {
    const previous = snapshot("de", { a: "h1" });
    const current = snapshot("de", { a: "h1-edited" });

    expect(diffLocaleSnapshots(previous, current)).toEqual({ added: 0, changed: 1, removed: 0 });
  });

  it("does not count a key present in both with the same hash", () => {
    const previous = snapshot("de", { a: "h1", b: "h2" });
    const current = snapshot("de", { a: "h1", b: "h2", c: "h3" });

    expect(diffLocaleSnapshots(previous, current)).toEqual({ added: 1, changed: 0, removed: 0 });
  });

  it("treats an empty previous snapshot as every current key being added (the startup-baseline case)", () => {
    const previous = snapshot("de", {});
    const current = snapshot("de", { a: "h1", b: "h2" });

    expect(diffLocaleSnapshots(previous, current)).toEqual({ added: 2, changed: 0, removed: 0 });
  });

  it("reports a mixed delta: one added, one changed, one removed, one unchanged", () => {
    const previous = snapshot("de", { keep: "h1", edit: "h2", drop: "h3" });
    const current = snapshot("de", { keep: "h1", edit: "h2-new", fresh: "h4" });

    expect(diffLocaleSnapshots(previous, current)).toEqual({ added: 1, changed: 1, removed: 1 });
  });
});
