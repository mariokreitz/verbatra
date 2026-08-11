import { describe, expect, it } from "vitest";
import { COLUMN, HEADERS } from "./layout.js";
import { MALFORMED_ROW_COLUMN, parseRowCells, rowCells } from "./row-shape.js";
import type { WorkbookRow } from "./types.js";

const row: WorkbookRow = {
  key: "greeting",
  source: "Hello",
  currentTarget: "Hallo",
  status: "changed",
  sourceHash: "abc123",
  translation: "Servus",
  context: "A greeting",
  reviewStatus: "review",
  reviewReasons: "equals-source",
};

describe("rowCells", () => {
  it("places every field at its COLUMN position", () => {
    const cells = rowCells(row);
    expect(cells).toHaveLength(HEADERS.length);
    expect(cells[COLUMN.key - 1]).toBe("greeting");
    expect(cells[COLUMN.source - 1]).toBe("Hello");
    expect(cells[COLUMN.current - 1]).toBe("Hallo");
    expect(cells[COLUMN.status - 1]).toBe("changed");
    expect(cells[COLUMN.translation - 1]).toBe("Servus");
    expect(cells[COLUMN.sourceHash - 1]).toBe("abc123");
    expect(cells[COLUMN.context - 1]).toBe("A greeting");
    expect(cells[COLUMN.reviewStatus - 1]).toBe("review");
    expect(cells[COLUMN.reviewReasons - 1]).toBe("equals-source");
  });

  it("round-trips a row through parseRowCells unchanged", () => {
    const outcome = parseRowCells(rowCells(row));
    expect(outcome.ok).toBe(true);
    expect(outcome.ok && outcome.row).toEqual(row);
  });
});

describe("parseRowCells", () => {
  it("trims the translation only, keeping every other field verbatim", () => {
    const cells = rowCells({ ...row, key: "  spaced  ", translation: "  Servus  " });
    const outcome = parseRowCells(cells);
    expect(outcome.ok && outcome.row.translation).toBe("Servus");
    expect(outcome.ok && outcome.row.key).toBe("  spaced  ");
  });

  it("reads a whitespace-only translation back as empty", () => {
    const outcome = parseRowCells(rowCells({ ...row, translation: "   " }));
    expect(outcome.ok && outcome.row.translation).toBe("");
  });

  it("rejects an unknown status on the Status column", () => {
    const cells = [...rowCells(row)];
    cells[COLUMN.status - 1] = "translated";
    const outcome = parseRowCells(cells);
    expect(outcome).toEqual({ ok: false, column: MALFORMED_ROW_COLUMN });
  });

  it("rejects an empty key", () => {
    const cells = [...rowCells(row)];
    cells[COLUMN.key - 1] = "";
    expect(parseRowCells(cells).ok).toBe(false);
  });

  it("treats a short cell list as empty cells, so a truncated row is rejected", () => {
    expect(parseRowCells(["greeting", "Hello"])).toEqual({
      ok: false,
      column: MALFORMED_ROW_COLUMN,
    });
  });

  it("falls back to 'ok' and no reasons for an unrecognized review status", () => {
    const cells = [...rowCells(row)];
    cells[COLUMN.reviewStatus - 1] = "maybe";
    const outcome = parseRowCells(cells);
    expect(outcome.ok && outcome.row.reviewStatus).toBe("ok");
  });
});
