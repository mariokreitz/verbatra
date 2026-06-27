import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadEnvFiles } from "./env.js";

const KEY = "VERBATRA_ENVTEST_KEY";
const QUOTED = "VERBATRA_ENVTEST_QUOTED";
const INLINE = "VERBATRA_ENVTEST_INLINE";

describe("loadEnvFiles", () => {
  let dir: string;
  let savedEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "verbatra-env-"));
    savedEnv = { ...process.env };
    for (const key of [KEY, QUOTED, INLINE]) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in savedEnv)) {
        delete process.env[key];
      }
    }
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value !== undefined) {
        process.env[key] = value;
      }
    }
    rmSync(dir, { recursive: true, force: true });
  });

  it("does not override a variable already set in the real environment", () => {
    process.env[KEY] = "real";
    writeFileSync(join(dir, ".env"), `${KEY}=fromenv\n`);
    writeFileSync(join(dir, ".env.local"), `${KEY}=fromlocal\n`);

    loadEnvFiles(dir);

    expect(process.env[KEY]).toBe("real");
  });

  it(".env.local wins over .env for the same key", () => {
    writeFileSync(join(dir, ".env"), `${KEY}=fromenv\n`);
    writeFileSync(join(dir, ".env.local"), `${KEY}=fromlocal\n`);

    loadEnvFiles(dir);

    expect(process.env[KEY]).toBe("fromlocal");
  });

  it("loads a key present only in .env", () => {
    writeFileSync(join(dir, ".env"), `${KEY}=fromenv\n`);

    loadEnvFiles(dir);

    expect(process.env[KEY]).toBe("fromenv");
  });

  it("is a silent no-op when no .env or .env.local files exist", () => {
    expect(() => loadEnvFiles(dir)).not.toThrow();
    expect(process.env[KEY]).toBeUndefined();
  });

  it("treats empty and comment-only files as a no-op", () => {
    writeFileSync(join(dir, ".env"), "# only a comment\n\n");
    writeFileSync(join(dir, ".env.local"), "");

    loadEnvFiles(dir);

    expect(process.env[KEY]).toBeUndefined();
  });

  it("relies on Node's parser for the grammar (quoted value and inline =)", () => {
    writeFileSync(join(dir, ".env"), `${QUOTED}="two words"\n${INLINE}=k=v\n`);

    loadEnvFiles(dir);

    expect(process.env[QUOTED]).toBe("two words");
    expect(process.env[INLINE]).toBe("k=v");
  });

  it("propagates a non-ENOENT read error (a directory named .env)", () => {
    mkdirSync(join(dir, ".env"));

    expect(() => loadEnvFiles(dir)).toThrow();
  });
});
