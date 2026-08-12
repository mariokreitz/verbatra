import { describe, expect, it } from "vitest";
import { buildDelimited } from "./build-delimited.js";
import { UTF8_BOM } from "./delimited-format.js";
import { HEADERS } from "./layout.js";
import type { WorkbookRow, WorkbookSheet } from "./types.js";

function row(overrides: Partial<WorkbookRow> = {}): WorkbookRow {
  return {
    key: "greeting",
    source: "Hello",
    currentTarget: "",
    status: "new",
    sourceHash: "abc123",
    translation: "",
    context: "",
    reviewStatus: "ok",
    reviewReasons: "",
    ...overrides,
  };
}

function sheet(rows: readonly WorkbookRow[]): WorkbookSheet {
  return { locale: "de", rows };
}

/** The file's lines with the BOM stripped, so a csv and a tsv can be asserted the same way. */
function lines(text: string): readonly string[] {
  const body = text.startsWith(UTF8_BOM) ? text.slice(UTF8_BOM.length) : text;
  return body.split("\n");
}

describe("buildDelimited", () => {
  it("writes the header line in column order, then one record per row", () => {
    const text = buildDelimited(sheet([row(), row({ key: "farewell" })]), "csv");
    const [header, first, second] = lines(text);
    expect(header).toBe(HEADERS.join(","));
    expect(first?.startsWith("greeting,Hello,")).toBe(true);
    expect(second?.startsWith("farewell,Hello,")).toBe(true);
  });

  it("writes the same content with a tab delimiter for tsv", () => {
    const csv = buildDelimited(sheet([row()]), "csv");
    const tsv = buildDelimited(sheet([row()]), "tsv");
    expect(lines(tsv)[0]).toBe(HEADERS.join("\t"));
    expect(lines(tsv).map((line) => line.split("\t").join(""))).toEqual(
      lines(csv).map((line) => line.split(",").join("")),
    );
  });

  it("writes a header-only file for a locale with no rows", () => {
    expect(lines(buildDelimited(sheet([]), "csv"))).toEqual([HEADERS.join(","), ""]);
  });

  it("ends every line with LF and terminates the file with one", () => {
    const text = buildDelimited(sheet([row()]), "tsv");
    expect(text.includes("\r")).toBe(false);
    expect(text.endsWith("\n")).toBe(true);
  });

  it("writes the UTF-8 BOM for csv and omits it for tsv", () => {
    expect(buildDelimited(sheet([row()]), "csv").startsWith(UTF8_BOM)).toBe(true);
    expect(buildDelimited(sheet([row()]), "tsv").startsWith(UTF8_BOM)).toBe(false);
  });
});

describe("buildDelimited quoting", () => {
  it("quotes a value containing the delimiter", () => {
    const text = buildDelimited(sheet([row({ source: "Hello, world" })]), "csv");
    expect(lines(text)[1]).toContain('"Hello, world"');
  });

  it("leaves a comma unquoted in a tsv, where it is not the delimiter", () => {
    const text = buildDelimited(sheet([row({ source: "Hello, world" })]), "tsv");
    expect(lines(text)[1]).toContain("\tHello, world\t");
  });

  it("quotes a value containing a double quote and doubles the quote", () => {
    const text = buildDelimited(sheet([row({ source: 'He said "hi"' })]), "csv");
    expect(lines(text)[1]).toContain('"He said ""hi"""');
  });

  it("quotes a value containing an embedded newline, keeping it inside one field", () => {
    const text = buildDelimited(sheet([row({ source: "Line one\nLine two" })]), "csv");
    expect(text).toContain('"Line one\nLine two"');
    expect(lines(text)).toHaveLength(4);
  });

  it("quotes a value with leading or trailing whitespace so it cannot be stripped", () => {
    const text = buildDelimited(sheet([row({ source: "  padded  " })]), "csv");
    expect(lines(text)[1]).toContain('"  padded  "');
  });
});
