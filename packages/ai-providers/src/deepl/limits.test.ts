import { describe, expect, it } from "vitest";
import {
  chunkTextsForDeepL,
  DEEPL_MAX_TEXT_PAYLOAD_BYTES,
  DEEPL_MAX_TEXTS_PER_REQUEST,
} from "./limits.js";

describe("chunkTextsForDeepL: text-count cap", () => {
  it("keeps an in-cap batch in a single chunk", () => {
    const texts = Array.from({ length: DEEPL_MAX_TEXTS_PER_REQUEST }, (_, i) => `t${i}`);
    expect(chunkTextsForDeepL(texts)).toEqual([texts]);
  });

  it("splits a batch one over the text-count cap into two chunks", () => {
    const texts = Array.from({ length: DEEPL_MAX_TEXTS_PER_REQUEST + 1 }, (_, i) => `t${i}`);
    const chunks = chunkTextsForDeepL(texts);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(DEEPL_MAX_TEXTS_PER_REQUEST);
    expect(chunks[1]).toHaveLength(1);
    expect(chunks.flat()).toEqual(texts);
  });
});

describe("chunkTextsForDeepL: byte-size cap", () => {
  it("splits when the combined byte size would exceed the payload budget", () => {
    const big = "x".repeat(DEEPL_MAX_TEXT_PAYLOAD_BYTES - 5);
    const texts = [big, "small-tail"];
    const chunks = chunkTextsForDeepL(texts);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual([big]);
    expect(chunks[1]).toEqual(["small-tail"]);
  });

  it("keeps texts together when their combined size fits the payload budget", () => {
    const texts = ["a".repeat(1000), "b".repeat(1000)];
    expect(chunkTextsForDeepL(texts)).toEqual([texts]);
  });

  it("places a single oversized text alone rather than dropping or corrupting it", () => {
    const oversized = "y".repeat(DEEPL_MAX_TEXT_PAYLOAD_BYTES + 1000);
    const chunks = chunkTextsForDeepL([oversized, "after"]);
    expect(chunks).toEqual([[oversized], ["after"]]);
  });

  it("budgets non-ASCII text by its inflated form-encoded size, not its raw UTF-8 byte count", () => {
    // Each "字" is 3 raw UTF-8 bytes but percent-encodes to 9 wire bytes ("%E5%AD%97").
    // A count that fits the raw-byte budget must still split once the encoded size does not.
    const charsPerChunk = Math.floor(DEEPL_MAX_TEXT_PAYLOAD_BYTES / 9);
    const rawBytesIfUnderestimated = charsPerChunk * 2 * 3;
    expect(rawBytesIfUnderestimated).toBeLessThan(DEEPL_MAX_TEXT_PAYLOAD_BYTES);

    const chunk = "字".repeat(charsPerChunk);
    const chunks = chunkTextsForDeepL([chunk, chunk]);
    expect(chunks).toEqual([[chunk], [chunk]]);
  });
});

describe("chunkTextsForDeepL: edge cases", () => {
  it("returns no chunks for an empty input", () => {
    expect(chunkTextsForDeepL([])).toEqual([]);
  });

  it("preserves order across chunk boundaries", () => {
    const texts = Array.from({ length: DEEPL_MAX_TEXTS_PER_REQUEST * 2 + 3 }, (_, i) => `t${i}`);
    const chunks = chunkTextsForDeepL(texts);
    expect(chunks.flat()).toEqual(texts);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(DEEPL_MAX_TEXTS_PER_REQUEST);
    }
  });
});
