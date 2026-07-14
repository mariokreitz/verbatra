import { Readable } from "node:stream";
import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";
import { buildWorkbook } from "./build-workbook.js";
import { ExchangeError } from "./errors.js";
import { DEFAULT_WORKBOOK_LIMITS } from "./limits.js";
import type { WorkbookModel } from "./types.js";
import { declaredSize, guardWorkbookBytes, streamEntryBounded } from "./zip-guard.js";

const model: WorkbookModel = {
  sheets: [
    {
      locale: "de",
      rows: [
        {
          key: "k1",
          source: "Hello",
          currentTarget: "",
          status: "new",
          sourceHash: "h1",
          translation: "",
          context: "",
          reviewStatus: "ok",
          reviewReasons: "",
        },
      ],
    },
  ],
};

/**
 * Run the guard and return whatever it rejects with, failing the test if it resolves. Every
 * assertion below checks the rejection is a structured ExchangeError, never a raw JSZip throw.
 */
async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error("expected guardWorkbookBytes to reject");
    },
    (error: unknown) => error,
  );
}

/** Assert the value is the structured exchange error with the WORKBOOK_INVALID code. */
function expectWorkbookInvalid(error: unknown): void {
  expect(error).toBeInstanceOf(ExchangeError);
  expect((error as ExchangeError).code).toBe("WORKBOOK_INVALID");
}

describe("guardWorkbookBytes: reject matrix", () => {
  it("rejects a container whose entry count exceeds maxEntryCount", async () => {
    const zip = new JSZip();
    for (let index = 0; index < 10; index += 1) {
      zip.file(`file${index}.txt`, "x");
    }
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const limits = { ...DEFAULT_WORKBOOK_LIMITS, maxEntryCount: 3 };
    expectWorkbookInvalid(await rejection(guardWorkbookBytes(bytes, limits)));
  });

  it("rejects in the declared-size pass when the summed declared sizes exceed the cap", async () => {
    // A single honest entry whose declared uncompressed size already exceeds the cap, so the
    // declared-size loop trips before any decompression happens.
    const zip = new JSZip();
    zip.file("big.txt", "A".repeat(5000));
    const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    const limits = { ...DEFAULT_WORKBOOK_LIMITS, maxDecompressedBytes: 1000 };
    expectWorkbookInvalid(await rejection(guardWorkbookBytes(bytes, limits)));
  });

  it("rejects a part that declares a DTD via DOCTYPE", async () => {
    const zip = new JSZip();
    zip.file("doctype.xml", '<?xml version="1.0"?><!DOCTYPE root><root></root>');
    const bytes = await zip.generateAsync({ type: "uint8array" });
    expectWorkbookInvalid(await rejection(guardWorkbookBytes(bytes, DEFAULT_WORKBOOK_LIMITS)));
  });

  it("rejects a part that declares an entity (XXE defense)", async () => {
    const zip = new JSZip();
    zip.file("entity.xml", '<?xml version="1.0"?><!ENTITY x "y">');
    const bytes = await zip.generateAsync({ type: "uint8array" });
    expectWorkbookInvalid(await rejection(guardWorkbookBytes(bytes, DEFAULT_WORKBOOK_LIMITS)));
  });

  it("rejects bytes that are not a loadable zip container", async () => {
    const bytes = new TextEncoder().encode("this is not a zip container at all");
    expectWorkbookInvalid(await rejection(guardWorkbookBytes(bytes, DEFAULT_WORKBOOK_LIMITS)));
  });

  it("rejects a real high-ratio DEFLATE bomb end to end", async () => {
    // End-to-end: a genuine high-ratio DEFLATE entry (tiny on disk, large uncompressed) is rejected
    // with the structured code. An honest declared size trips the fast-fail declared-size pass here;
    // the streaming pass and its bounded real production are locked in separately below. 2 MiB is far
    // above the 4 KiB cap so the ratio is clearly a bomb, while keeping the fixture cheap to build.
    const zip = new JSZip();
    zip.file("bomb.bin", "A".repeat(2 * 1024 * 1024));
    const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    const limits = { ...DEFAULT_WORKBOOK_LIMITS, maxDecompressedBytes: 4096 };
    expectWorkbookInvalid(await rejection(guardWorkbookBytes(bytes, limits)));
    // Deflating the fixture is real, event-loop-yielding work; under parallel-worker CPU contention
    // its wall-clock can drift past vitest's 5s default even though CPU time is small. Give margin.
  }, 30_000);
});

describe("guardWorkbookBytes: accept", () => {
  it("resolves for a well-formed workbook within all caps and free of any DTD or entity", async () => {
    const bytes = await buildWorkbook(model);
    await expect(guardWorkbookBytes(bytes, DEFAULT_WORKBOOK_LIMITS)).resolves.toBeUndefined();
  });

  it("accepts a binary part whose raw decompressed bytes are under the cap even though decoding it as UTF-8 would inflate the byte count past the cap", async () => {
    // A stored entry of 1000 raw 0xFF bytes, the kind of binary content a real workbook carries in
    // parts such as docProps/thumbnail.jpeg or xl/media/*. The raw decompressed size (1000) is under
    // the 2000 cap and must be accepted. Decoding those bytes as UTF-8 is lossy: each invalid byte
    // becomes a U+FFFD replacement character (3 bytes wide), so the decoded string re-encodes to 3000
    // bytes, past the cap. The cap must be enforced against the raw decompressed count, not the
    // re-encoded UTF-8 length.
    const raw = new Uint8Array(1000).fill(0xff);
    const zip = new JSZip();
    zip.file("docProps/thumbnail.jpeg", raw);
    const bytes = await zip.generateAsync({ type: "uint8array", compression: "STORE" });
    const limits = { ...DEFAULT_WORKBOOK_LIMITS, maxDecompressedBytes: 2000 };
    await expect(guardWorkbookBytes(bytes, limits)).resolves.toBeUndefined();
  });
});

describe("streamEntryBounded", () => {
  it("aborts before materializing an entry once the running total passes the budget", async () => {
    // A stub whose stream would yield roughly 100 MiB in 1 KiB chunks, tracked by a shared pull
    // counter. With a 64 KiB budget the loop must break after reading only a bounded slice, proving
    // abort-before-materialize instead of pulling all 100000 chunks.
    let pulls = 0;
    async function* gen(): AsyncGenerator<Buffer> {
      for (let index = 0; index < 100_000; index += 1) {
        pulls += 1;
        yield Buffer.alloc(1024, 0x41);
      }
    }
    const stub = { nodeStream: () => Readable.from(gen()) };
    const remaining = 64 * 1024;
    expectWorkbookInvalid(await rejection(streamEntryBounded(stub, remaining)));
    expect(pulls).toBeLessThan(200);
  });

  it("rethrows a stream error as an undecompressable-entry WORKBOOK_INVALID", async () => {
    const stub = {
      nodeStream: () =>
        new Readable({
          read() {
            this.destroy(new Error("corrupt deflate stream"));
          },
        }),
    };
    expectWorkbookInvalid(await rejection(streamEntryBounded(stub, 64 * 1024)));
  });

  it("accumulates string chunks and returns the raw byte count with the decoded UTF-8 content", async () => {
    const stub = { nodeStream: () => Readable.from(["abc", "def"]) };
    await expect(streamEntryBounded(stub, 64 * 1024)).resolves.toEqual({
      raw: 6,
      content: "abcdef",
    });
  });

  it("reports a raw byte count that reflects true decompressed bytes, not the UTF-8 re-encoded decoded string", async () => {
    // 4 raw bytes that are not valid UTF-8 (a lone continuation byte, then a truncated sequence)
    // decode lossily to more than 4 U+FFFD replacement characters, which would re-encode to more
    // than 4 UTF-8 bytes. The raw count returned must stay the true 4, proving it is measured from
    // the stream, never from the decoded text.
    const invalidUtf8 = Buffer.from([0x80, 0xc2, 0xff, 0xfe]);
    const stub = { nodeStream: () => Readable.from([invalidUtf8]) };
    const result = await streamEntryBounded(stub, 64 * 1024);
    expect(result.raw).toBe(4);
    expect(Buffer.byteLength(result.content, "utf8")).toBeGreaterThan(4);
  });

  it("bounds real JSZip production on a high-ratio DEFLATE entry regardless of its size", async () => {
    // The security lock: drive the ACTUAL JSZip nodeStream that the Readable.wrap adaptation exists
    // for (not a stub) and measure the bytes the underlying inflate worker really produces. An entry
    // of one repeated byte compresses to a tiny zip; spying on nodeStream and summing its 'data'
    // bytes shows the break-on-breach abort tears the worker down after roughly the 64 KiB budget, so
    // production stays a few hundred KiB, far below the full entry. producedBytes > 0 proves the
    // assertion is not vacuous (the real worker ran); the upper bound proves it was bounded. A
    // regression that stopped halting the worker (a JSZip upgrade or a pipe/pipeline refactor) would
    // inflate the whole entry and fail the upper bound, where a rejection-only test would stay green.
    // The entry only needs to be far larger than the produced bound; the worker's output is a
    // constant a few hundred KiB regardless of size. 16 MiB keeps building the fixture fast in CI.
    const uncompressedBytes = 16 * 1024 * 1024;
    const zip = new JSZip();
    zip.file("bomb.bin", "A".repeat(uncompressedBytes));
    const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    const loaded = await JSZip.loadAsync(bytes);
    const file = Object.values(loaded.files).find((entry) => !entry.dir);
    expect(file).toBeDefined();
    const realFile = file as JSZip.JSZipObject;

    const originalNodeStream = realFile.nodeStream.bind(realFile);
    let producedBytes = 0;
    const spy = vi.spyOn(realFile, "nodeStream").mockImplementation((type?: "nodebuffer") => {
      const stream = originalNodeStream(type);
      stream.on("data", (chunk: Buffer | string) => {
        producedBytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
      });
      return stream;
    });

    try {
      expectWorkbookInvalid(await rejection(streamEntryBounded(realFile, 64 * 1024)));
      expect(producedBytes).toBeGreaterThan(0);
      expect(producedBytes).toBeLessThan(1024 * 1024);
      expect(producedBytes).toBeLessThan(uncompressedBytes);
    } finally {
      spy.mockRestore();
    }
    // Building and deflating the fixture is real work; give a slow or loaded CI runner ample margin
    // over vitest's 5s default so this can never flake on wall-clock rather than on the property.
  }, 30_000);
});

describe("declaredSize: JSZip internals canary", () => {
  it("returns the known uncompressed size of a good zip so an internals rename fails loudly", async () => {
    const content = "hello canary";
    const zip = new JSZip();
    zip.file("known.txt", content);
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const loaded = await JSZip.loadAsync(bytes);
    const file = loaded.file("known.txt");
    expect(file).not.toBeNull();
    const size = declaredSize(file as JSZip.JSZipObject);
    expect(typeof size).toBe("number");
    expect(size).toBe(Buffer.byteLength(content, "utf8"));
  });

  it("returns undefined when the entry omits or malforms the uncompressed size metadata", () => {
    expect(declaredSize({} as JSZip.JSZipObject)).toBeUndefined();
    expect(
      declaredSize({ _data: { uncompressedSize: "not a number" } } as unknown as JSZip.JSZipObject),
    ).toBeUndefined();
  });
});
