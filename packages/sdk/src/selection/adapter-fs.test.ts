import { describe, expect, it } from "vitest";
import { makeFakeFs } from "../test-support.js";
import { toAdapterFs } from "./adapter-fs.js";

describe("toAdapterFs", () => {
  it("serves content the SdkFs holds", async () => {
    const fs = toAdapterFs(
      makeFakeFs({ readFileBounded: async () => ({ kind: "ok", content: '{"a":"b"}' }) }),
    );
    expect(await fs.readBounded("/virtual/en.json", 1024)).toEqual({
      kind: "ok",
      content: '{"a":"b"}',
    });
  });

  it("rejects a missing file with an ENOENT-shaped error, which the adapters branch on", async () => {
    const fs = toAdapterFs(makeFakeFs());
    const error = await fs.readBounded("/virtual/absent.json", 1024).catch((e: unknown) => e);
    expect((error as NodeJS.ErrnoException).code).toBe("ENOENT");
    expect((error as Error).message).toContain("/virtual/absent.json");
  });

  it("passes an over-size file through as a too-large outcome rather than throwing", async () => {
    const fs = toAdapterFs(makeFakeFs({ readFileBounded: async () => ({ kind: "too-large" }) }));
    expect(await fs.readBounded("/virtual/huge.json", 1)).toEqual({ kind: "too-large" });
  });

  it("forwards the caller's byte cap to the SdkFs", async () => {
    const seen: number[] = [];
    const fs = toAdapterFs(
      makeFakeFs({
        readFileBounded: async (_path: string, maxBytes: number) => {
          seen.push(maxBytes);
          return { kind: "ok", content: "" };
        },
      }),
    );
    await fs.readBounded("/virtual/en.json", 4096);
    expect(seen).toEqual([4096]);
  });
});
