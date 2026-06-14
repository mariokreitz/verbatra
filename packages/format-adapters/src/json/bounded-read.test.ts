import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readBounded } from "./bounded-read.js";
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
