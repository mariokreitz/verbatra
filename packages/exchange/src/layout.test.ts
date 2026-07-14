import { describe, expect, it } from "vitest";
import { COLUMN, HEADER_ROW, HEADERS, INSTRUCTIONS_SHEET_NAME } from "./layout.js";

describe("layout: column map", () => {
  it("maps each field to its fixed 1-based column index", () => {
    expect(COLUMN).toEqual({
      key: 1,
      source: 2,
      current: 3,
      status: 4,
      translation: 5,
      sourceHash: 6,
      context: 7,
    });
  });

  it("assigns a unique consecutive index to every field starting at 1", () => {
    const indices = Object.values(COLUMN);
    const sorted = [...indices].sort((a, b) => a - b);
    expect(sorted).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(new Set(indices).size).toBe(indices.length);
  });

  it("places the sole editable column (translation) after the read-only columns", () => {
    expect(COLUMN.translation).toBeGreaterThan(COLUMN.status);
    expect(COLUMN.sourceHash).toBeGreaterThan(COLUMN.translation);
  });

  it("appends context after source hash instead of inserting it before translation", () => {
    expect(COLUMN.context).toBeGreaterThan(COLUMN.sourceHash);
    expect(COLUMN.translation).toBe(5);
  });
});

describe("layout: headers", () => {
  it("lists one header per column in column order", () => {
    expect(HEADERS).toEqual([
      "Key",
      "Source",
      "Current translation",
      "Status",
      "Translation",
      "Source hash",
      "Context",
    ]);
  });

  it("has exactly as many headers as the column map has fields", () => {
    expect(HEADERS).toHaveLength(Object.keys(COLUMN).length);
  });

  it("labels the round-trip identity and drift-detection columns the reader matches", () => {
    expect(HEADERS[COLUMN.key - 1]).toBe("Key");
    expect(HEADERS[COLUMN.sourceHash - 1]).toBe("Source hash");
  });
});

describe("layout: fixed positions", () => {
  it("puts the header on the first row so data rows start at row 2", () => {
    expect(HEADER_ROW).toBe(1);
  });

  it("names the instructions sheet so the reader can exclude it from the data scan", () => {
    expect(INSTRUCTIONS_SHEET_NAME).toBe("Instructions");
  });
});
