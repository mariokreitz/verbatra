import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AdapterError } from "../errors.js";
import { readBounded, readFileContent } from "./bounded-read.js";
import { MAX_INPUT_BYTES } from "./limits.js";

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "verbatra-bounded-"));
}

async function tempFile(content: string | Uint8Array): Promise<string> {
  const path = join(await tempDir(), "input.json");
  await writeFile(path, content);
  return path;
}

describe("readBounded", () => {
  it("returns the file content for a regular file within the size cap", async () => {
    const outcome = await readBounded(await tempFile('{"a":"b"}'));
    expect(outcome).toEqual({ kind: "ok", content: '{"a":"b"}' });
  });

  it("returns ok with empty content for an empty file", async () => {
    const outcome = await readBounded(await tempFile(""));
    expect(outcome).toEqual({ kind: "ok", content: "" });
  });

  it("strips a single leading UTF-8 BOM from the content", async () => {
    const outcome = await readBounded(await tempFile('﻿{"a":"b"}'));
    expect(outcome).toEqual({ kind: "ok", content: '{"a":"b"}' });
  });

  it("leaves interior BOM characters untouched", async () => {
    const outcome = await readBounded(await tempFile('{"a":"b﻿c"}'));
    expect(outcome).toEqual({ kind: "ok", content: '{"a":"b﻿c"}' });
  });

  it("returns ok with empty content for a BOM-only file", async () => {
    const outcome = await readBounded(await tempFile("﻿"));
    expect(outcome).toEqual({ kind: "ok", content: "" });
  });

  it("reports too-large for a file over the byte cap without returning its content", async () => {
    const outcome = await readBounded(await tempFile(new Uint8Array(MAX_INPUT_BYTES + 1)));
    expect(outcome).toEqual({ kind: "too-large" });
  });

  it("reports not-a-file for a directory path", async () => {
    const outcome = await readBounded(await tempDir());
    expect(outcome).toEqual({ kind: "not-a-file" });
  });

  it("rejects for a missing path (callers handle it)", async () => {
    await expect(readBounded(join(await tempDir(), "absent.json"))).rejects.toThrow();
  });
});

describe("readFileContent", () => {
  it("returns the content for a regular file", async () => {
    expect(await readFileContent(await tempFile("hi"))).toBe("hi");
  });

  it("maps a directory to a structured INVALID_STRUCTURE", async () => {
    const error = await readFileContent(await tempDir()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AdapterError);
    expect((error as AdapterError).code).toBe("INVALID_STRUCTURE");
  });

  it("maps an over-size file to a structured INPUT_TOO_LARGE", async () => {
    const error = await readFileContent(await tempFile(new Uint8Array(MAX_INPUT_BYTES + 1))).catch(
      (e: unknown) => e,
    );
    expect((error as AdapterError).code).toBe("INPUT_TOO_LARGE");
  });
});
