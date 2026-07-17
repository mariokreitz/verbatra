import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SdkError } from "../errors.js";
import { defaultFs } from "../fs.js";
import { makeFakeFs, makeTempDir } from "../test-support.js";
import { resolveGlossary } from "./resolve-glossary.js";

async function expectConfigInvalid(promise: Promise<unknown>, path: string): Promise<SdkError> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(SdkError);
  const sdkError = error as SdkError;
  expect(sdkError.code).toBe("CONFIG_INVALID");
  expect(sdkError.message).toContain(path);
  return sdkError;
}

describe("resolveGlossary: inline and absent forms", () => {
  it("passes an inline record through unchanged with inline provenance", async () => {
    const result = await resolveGlossary({ hello: "hallo" }, "/anywhere", defaultFs);
    expect(result).toEqual({ glossary: { hello: "hallo" }, provenance: { source: "inline" } });
  });

  it("returns an undefined glossary with none provenance when absent", async () => {
    const result = await resolveGlossary(undefined, "/anywhere", defaultFs);
    expect(result).toEqual({ glossary: undefined, provenance: { source: "none" } });
  });
});

describe("resolveGlossary: file path resolution", () => {
  it("reads a valid glossary file relative to baseDir with file provenance", async () => {
    const dir = await makeTempDir();
    const file = join(dir, "glossary.json");
    await writeFile(file, JSON.stringify({ hello: "hallo" }), "utf8");

    const result = await resolveGlossary("glossary.json", dir, defaultFs);

    expect(result.glossary).toEqual({ hello: "hallo" });
    expect(result.provenance).toEqual({ source: "file", path: file });
  });

  it("resolves an absolute glossary path as given, ignoring baseDir", async () => {
    const dir = await makeTempDir();
    const file = join(dir, "glossary.json");
    await writeFile(file, JSON.stringify({ hi: "hoi" }), "utf8");

    const result = await resolveGlossary(file, "/some/other/dir", defaultFs);

    expect(result.glossary).toEqual({ hi: "hoi" });
    expect(result.provenance).toEqual({ source: "file", path: file });
  });

  it("resolves a nested relative glossary path against baseDir", async () => {
    const dir = await makeTempDir();
    const file = join(dir, "nested", "glossary.json");
    await mkdir(join(dir, "nested"));
    await writeFile(file, JSON.stringify({ hello: "hallo" }), "utf8");

    const result = await resolveGlossary("nested/glossary.json", dir, defaultFs);

    expect(result.glossary).toEqual({ hello: "hallo" });
    expect(result.provenance).toEqual({ source: "file", path: file });
  });
});

describe("resolveGlossary: failure modes (structured, secret-free, naming the resolved path)", () => {
  it("a missing glossary file is CONFIG_INVALID naming the resolved path", async () => {
    const dir = await makeTempDir();
    const missing = join(dir, "absent.json");

    await expectConfigInvalid(resolveGlossary("absent.json", dir, defaultFs), missing);
  });

  it("an invalid JSON glossary file is CONFIG_INVALID naming the resolved path", async () => {
    const dir = await makeTempDir();
    const file = join(dir, "bad.json");
    await writeFile(file, "{ not valid json", "utf8");

    const error = await expectConfigInvalid(resolveGlossary("bad.json", dir, defaultFs), file);
    expect(error.message).toContain("not valid JSON");
  });

  it("a glossary file with the wrong shape (non-string value) is CONFIG_INVALID", async () => {
    const dir = await makeTempDir();
    const file = join(dir, "wrong.json");
    await writeFile(file, JSON.stringify({ hello: 5 }), "utf8");

    await expectConfigInvalid(resolveGlossary("wrong.json", dir, defaultFs), file);
  });

  it("a nested glossary object (not a flat record) is CONFIG_INVALID", async () => {
    const dir = await makeTempDir();
    const file = join(dir, "nested-shape.json");
    await writeFile(file, JSON.stringify({ hello: { nested: "no" } }), "utf8");

    await expectConfigInvalid(resolveGlossary("nested-shape.json", dir, defaultFs), file);
  });

  it("a glossary file that is not a JSON object (an array) is CONFIG_INVALID", async () => {
    const dir = await makeTempDir();
    const file = join(dir, "array.json");
    await writeFile(file, JSON.stringify(["hello", "hallo"]), "utf8");

    await expectConfigInvalid(resolveGlossary("array.json", dir, defaultFs), file);
  });

  it("an over-cap glossary file is CONFIG_INVALID naming the resolved path", async () => {
    const dir = await makeTempDir();
    const file = join(dir, "big.json");
    await writeFile(file, JSON.stringify({ hello: "x".repeat(2 * 1024 * 1024) }), "utf8");

    const error = await expectConfigInvalid(resolveGlossary("big.json", dir, defaultFs), file);
    expect(error.message).toContain("maximum allowed size");
  });

  it("an empty glossary file is CONFIG_INVALID (invalid JSON, not an empty record)", async () => {
    const dir = await makeTempDir();
    const file = join(dir, "empty.json");
    await writeFile(file, "", "utf8");

    const error = await expectConfigInvalid(resolveGlossary("empty.json", dir, defaultFs), file);
    expect(error.message).toContain("not valid JSON");
  });

  it("a whitespace-only (CRLF) glossary file is CONFIG_INVALID", async () => {
    const dir = await makeTempDir();
    const file = join(dir, "whitespace.json");
    await writeFile(file, "\r\n\r\n", "utf8");

    await expectConfigInvalid(resolveGlossary("whitespace.json", dir, defaultFs), file);
  });

  it("a UTF-16LE-encoded glossary file is CONFIG_INVALID naming UTF-8 encoding", async () => {
    const dir = await makeTempDir();
    const file = join(dir, "utf16.json");
    await writeFile(file, Buffer.from(JSON.stringify({ hello: "hallo" }), "utf16le"));

    const error = await expectConfigInvalid(resolveGlossary("utf16.json", dir, defaultFs), file);
    expect(error.message.toLowerCase()).toContain("utf-8");
  });

  it("two invalid lead bytes decode to a leading replacement character and are CONFIG_INVALID", async () => {
    const dir = await makeTempDir();
    const file = join(dir, "invalid-lead-bytes.json");
    const bytes = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from(JSON.stringify({ hello: "hallo" }), "utf8"),
    ]);
    await writeFile(file, bytes);

    const error = await expectConfigInvalid(
      resolveGlossary("invalid-lead-bytes.json", dir, defaultFs),
      file,
    );
    expect(error.message.toLowerCase()).toContain("utf-8");
  });

  it("propagates a too-large result from an injected fs seam without touching the real disk", async () => {
    const fakeFs = makeFakeFs({ readFileBounded: async () => ({ kind: "too-large" }) });
    const expectedPath = resolve("/base", "anywhere.json");

    const error = await expectConfigInvalid(
      resolveGlossary("anywhere.json", "/base", fakeFs),
      expectedPath,
    );
    expect(error.message).toContain("maximum allowed size");
  });
});

describe("resolveGlossary: content handling", () => {
  it("strips a UTF-8 BOM prefix and loads the valid glossary underneath it", async () => {
    const dir = await makeTempDir();
    const file = join(dir, "bom.json");
    await writeFile(file, `\uFEFF${JSON.stringify({ hello: "hallo" })}`, "utf8");

    const result = await resolveGlossary("bom.json", dir, defaultFs);

    expect(result.glossary).toEqual({ hello: "hallo" });
  });

  it("resolves duplicate JSON keys last-wins", async () => {
    const dir = await makeTempDir();
    const file = join(dir, "dup.json");
    await writeFile(file, '{ "hello": "first", "hello": "second" }', "utf8");

    const result = await resolveGlossary("dup.json", dir, defaultFs);

    expect(result.glossary).toEqual({ hello: "second" });
  });
});
