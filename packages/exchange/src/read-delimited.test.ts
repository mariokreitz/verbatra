import { describe, expect, it } from "vitest";
import { UTF8_BOM } from "./delimited-format.js";
import { DEFAULT_DELIMITED_LIMITS } from "./delimited-limits.js";
import { ExchangeError } from "./errors.js";
import { HEADERS } from "./layout.js";
import { readDelimited } from "./read-delimited.js";
import { expectWorkbookInvalid } from "./test-support.js";

const HEADER_LINE = HEADERS.join(",");

/** One well-formed csv record: key, source, current, status, translation, hash, and the rest empty. */
function record(
  key: string,
  source = "Hello",
  status = "new",
  translation = "",
  hash = "abc123",
): string {
  return [key, source, "", status, translation, hash, "", "ok", ""].join(",");
}

function csv(...records: readonly string[]): string {
  return [HEADER_LINE, ...records].join("\n");
}

function read(text: string, format: "csv" | "tsv" = "csv") {
  return readDelimited({ text, locale: "de", format });
}

describe("readDelimited", () => {
  it("returns the locale it was given as the single sheet", () => {
    const data = read(csv(record("greeting")));
    expect(data.sheets).toHaveLength(1);
    expect(data.sheets[0]?.locale).toBe("de");
    expect(data.sheets[0]?.rows.map((r) => r.key)).toEqual(["greeting"]);
  });

  it("consumes a leading UTF-8 BOM instead of reading it as part of the first key", () => {
    const data = read(`${UTF8_BOM}${csv(record("greeting"))}`);
    expect(data.sheets[0]?.rows[0]?.key).toBe("greeting");
  });

  it("accepts CRLF record separators as well as LF", () => {
    const data = read([HEADER_LINE, record("a"), record("b"), ""].join("\r\n"));
    expect(data.sheets[0]?.rows.map((r) => r.key)).toEqual(["a", "b"]);
  });

  it("accepts a lone CR as a record separator", () => {
    const data = read([HEADER_LINE, record("a"), record("b")].join("\r"));
    expect(data.sheets[0]?.rows.map((r) => r.key)).toEqual(["a", "b"]);
  });

  it("accepts a file with no trailing line break", () => {
    const data = read(csv(record("a")));
    expect(data.sheets[0]?.rows).toHaveLength(1);
  });

  it("skips blank lines and records with an empty key", () => {
    const data = read([HEADER_LINE, record("a"), "", record(""), ""].join("\n"));
    expect(data.sheets[0]?.rows.map((r) => r.key)).toEqual(["a"]);
    expect(data.malformedRows).toEqual([]);
  });

  it("reads a tab-delimited file through the same path", () => {
    const text = [
      HEADERS.join("\t"),
      ["a", "Hello", "", "new", "Hallo", "h", "", "ok", ""].join("\t"),
    ].join("\n");
    const data = read(text, "tsv");
    expect(data.sheets[0]?.rows[0]?.translation).toBe("Hallo");
  });

  it("keeps a blanked source hash verbatim so the import drift check can reject the row", () => {
    const data = read(csv(record("a", "Hello", "new", "Hallo", "")));
    expect(data.sheets[0]?.rows[0]?.sourceHash).toBe("");
    expect(data.sheets[0]?.rows[0]?.translation).toBe("Hallo");
  });
});

describe("readDelimited quoting", () => {
  it("unquotes a field containing the delimiter", () => {
    const data = read(csv(record("a", '"Hello, world"')));
    expect(data.sheets[0]?.rows[0]?.source).toBe("Hello, world");
  });

  it("reads a doubled quote inside a quoted field as one literal quote", () => {
    const data = read(csv(record("a", '"He said ""hi"""')));
    expect(data.sheets[0]?.rows[0]?.source).toBe('He said "hi"');
  });

  it("keeps a line break inside a quoted field in the field, not between records", () => {
    const data = read(csv(record("a", '"Line one\nLine two"'), record("b")));
    expect(data.sheets[0]?.rows[0]?.source).toBe("Line one\nLine two");
    expect(data.sheets[0]?.rows.map((r) => r.key)).toEqual(["a", "b"]);
  });

  it("keeps leading and trailing whitespace inside a quoted field", () => {
    const data = read(csv(record("a", '"  padded  "')));
    expect(data.sheets[0]?.rows[0]?.source).toBe("  padded  ");
  });

  it("appends anything left after a closing quote instead of discarding the record", () => {
    const data = read(csv(record("a", '"Hello"there')));
    expect(data.sheets[0]?.rows[0]?.source).toBe("Hellothere");
  });

  it("reports a record whose quoted field is never closed as malformed, not as a throw", () => {
    const data = read(csv(record("a", '"unterminated')));
    expect(data.sheets[0]?.rows).toEqual([]);
    expect(data.malformedRows).toHaveLength(1);
  });
});

describe("readDelimited structural problems", () => {
  it("reports a malformed record per row and keeps reading the rest of the file", () => {
    const data = read(csv(record("a"), "b,Hello,,translated,,h,,ok,", record("c")));
    expect(data.sheets[0]?.rows.map((r) => r.key)).toEqual(["a", "c"]);
    expect(data.malformedRows).toEqual([{ locale: "de", row: 3, line: 3, column: "Status" }]);
  });

  it("reports a record with too few fields on the first column it does not supply", () => {
    const data = read(csv(record("a"), "b,Hello,,new"));
    expect(data.sheets[0]?.rows.map((r) => r.key)).toEqual(["a"]);
    expect(data.malformedRows).toEqual([{ locale: "de", row: 3, line: 3, column: "Translation" }]);
  });

  it("reports a record with too many fields on the last defined column", () => {
    const data = read(csv(`${record("b")},extra`));
    expect(data.malformedRows).toEqual([
      { locale: "de", row: 2, line: 2, column: "Review reasons" },
    ]);
  });

  it("keeps the first occurrence of a duplicated key and reports every later one", () => {
    const data = read(csv(record("a", "One"), record("a", "Two"), record("a", "Three")));
    expect(data.sheets[0]?.rows.map((r) => r.source)).toEqual(["One"]);
    expect(data.duplicateKeys).toEqual([
      { locale: "de", key: "a", row: 3, line: 3 },
      { locale: "de", key: "a", row: 4, line: 4 },
    ]);
  });

  it("rejects a file with no header line", async () => {
    await expectWorkbookInvalid(() => read(""));
  });

  it("rejects a header line with the wrong number of columns", async () => {
    const error = await expectWorkbookInvalid(() => read(["Key,Source", record("a")].join("\n")));
    expect(error.message).not.toContain("Hello");
  });

  it("rejects a header line whose columns were renamed or reordered", async () => {
    const swapped = [...HEADERS];
    swapped[1] = "Original";
    await expectWorkbookInvalid(() => read([swapped.join(","), record("a")].join("\n")));
  });
});

describe("readDelimited reported line numbers", () => {
  /** Every record separator the reader accepts, each also used as the embedded break in a quoted field. */
  const SEPARATORS = [
    ["LF", "\n"],
    ["CRLF", "\r\n"],
    ["a lone CR", "\r"],
  ] as const;

  it.each(SEPARATORS)(
    "reports the file line of a malformed record after a quoted %s break",
    (_name, separator) => {
      const text = [
        HEADER_LINE,
        record("a", `"Line one${separator}Line two"`),
        "b,Hello,,translated,,h,,ok,",
      ].join(separator);
      expect(read(text).malformedRows).toEqual([
        { locale: "de", row: 3, line: 4, column: "Status" },
      ]);
    },
  );

  it.each(SEPARATORS)(
    "reports the file line of a duplicate key after a quoted %s break",
    (_name, separator) => {
      const text = [
        HEADER_LINE,
        record("a", `"Line one${separator}Line two"`),
        record("a", "Again"),
      ].join(separator);
      expect(read(text).duplicateKeys).toEqual([{ locale: "de", key: "a", row: 3, line: 4 }]);
    },
  );

  it("counts every quoted break in every earlier record, not just the first", () => {
    const text = [
      HEADER_LINE,
      record("a", '"one\ntwo\nthree"'),
      record("b", '"four\nfive"'),
      "c,Hello,,translated,,h,,ok,",
    ].join("\n");
    expect(read(text).malformedRows).toEqual([{ locale: "de", row: 4, line: 7, column: "Status" }]);
  });

  it("counts a break in any field of a record, not only the first field", () => {
    const text = [
      HEADER_LINE,
      record("a", "Hello", "new", '"Hallo\nWelt"'),
      "b,Hello,,translated,,h,,ok,",
    ].join("\n");
    expect(read(text).malformedRows).toEqual([{ locale: "de", row: 3, line: 4, column: "Status" }]);
  });

  it("counts a blank line as both a record and a line", () => {
    const text = [HEADER_LINE, record("a"), "", "c,Hello,,translated,,h,,ok,"].join("\n");
    expect(read(text).malformedRows).toEqual([{ locale: "de", row: 4, line: 4, column: "Status" }]);
  });

  it("reports the line the record starts on, not the line it ends on", () => {
    const text = [HEADER_LINE, `b,"Hello\nthere",,translated,,h,,ok,`, record("c")].join("\n");
    expect(read(text).malformedRows).toEqual([{ locale: "de", row: 2, line: 2, column: "Status" }]);
    expect(read(text).sheets[0]?.rows.map((r) => r.key)).toEqual(["c"]);
  });
});

describe("readDelimited bounds", () => {
  it("rejects input larger than maxInputBytes", () => {
    const text = csv(record("a", "x".repeat(64)));
    const call = () =>
      readDelimited(
        { text, locale: "de", format: "csv" },
        { limits: { ...DEFAULT_DELIMITED_LIMITS, maxInputBytes: 32 } },
      );
    expect(call).toThrow(ExchangeError);
    expect(call).toThrow(/32 bytes/);
  });

  it("rejects more data rows than maxRowsPerFile", () => {
    const text = csv(record("a"), record("b"), record("c"));
    expect(() =>
      readDelimited(
        { text, locale: "de", format: "csv" },
        { limits: { ...DEFAULT_DELIMITED_LIMITS, maxRowsPerFile: 2 } },
      ),
    ).toThrow(/maximum of 2 rows/);
  });

  it("rejects a record with more fields than maxFieldsPerRow", () => {
    const text = csv(record("a"));
    expect(() =>
      readDelimited(
        { text, locale: "de", format: "csv" },
        { limits: { ...DEFAULT_DELIMITED_LIMITS, maxFieldsPerRow: 4 } },
      ),
    ).toThrow(/maximum of 4 fields/);
  });

  it("rejects a field longer than maxFieldLength", () => {
    const text = csv(record("a", "x".repeat(32)));
    expect(() =>
      readDelimited(
        { text, locale: "de", format: "csv" },
        { limits: { ...DEFAULT_DELIMITED_LIMITS, maxFieldLength: 8 } },
      ),
    ).toThrow(/maximum of 8 characters/);
  });

  it("embeds no field content in a cap failure", async () => {
    const text = csv(record("secret-key", "secret source text"));
    const error = await expectWorkbookInvalid(() =>
      readDelimited(
        { text, locale: "de", format: "csv" },
        { limits: { ...DEFAULT_DELIMITED_LIMITS, maxInputBytes: 16 } },
      ),
    );
    expect(error.message).not.toContain("secret");
  });
});

/**
 * The caps have to fire DURING the scan, not over its finished output. A bare line break is one
 * record and a bare delimiter is one field, so an input well under `maxInputBytes` can expand into
 * millions of records or fields; checking the caps afterwards means that memory is already spent and
 * the process can die before any check runs.
 *
 * Each test below pins the ordering that only an in-scan check can produce: the input carries a
 * second, later breach that a scan-then-check implementation would reach first and report instead.
 * The reported cap therefore proves the earlier one fired before the rest of the input was expanded.
 */
describe("readDelimited enforces its bounds during the scan, not after it", () => {
  it("stops at the record that breaches maxRowsPerFile, before scanning a later oversized field", () => {
    const text = [
      HEADER_LINE,
      record("a"),
      record("b"),
      record("c"),
      record("d", "x".repeat(64)),
    ].join("\n");

    expect(() =>
      readDelimited(
        { text, locale: "de", format: "csv" },
        { limits: { ...DEFAULT_DELIMITED_LIMITS, maxRowsPerFile: 2, maxFieldLength: 24 } },
      ),
    ).toThrow(/maximum of 2 rows/);
  });

  it("stops at the field that breaches maxFieldLength, before scanning the rest of its record", () => {
    const text = [HEADER_LINE, ["y".repeat(64), ...Array<string>(11).fill("x")].join(",")].join(
      "\n",
    );

    expect(() =>
      readDelimited(
        { text, locale: "de", format: "csv" },
        { limits: { ...DEFAULT_DELIMITED_LIMITS, maxFieldsPerRow: 10, maxFieldLength: 24 } },
      ),
    ).toThrow(/maximum of 24 characters/);
  });

  it("rejects a run of bare line breaks that would otherwise expand into one record each", () => {
    const text = `${HEADER_LINE}\n${"\n".repeat(64)}`;

    expect(() =>
      readDelimited(
        { text, locale: "de", format: "csv" },
        { limits: { ...DEFAULT_DELIMITED_LIMITS, maxRowsPerFile: 4 } },
      ),
    ).toThrow(/maximum of 4 rows/);
  });

  it("rejects a run of bare delimiters that would otherwise expand into one field each", () => {
    const text = `${HEADER_LINE}\n${",".repeat(64)}`;

    expect(() =>
      readDelimited(
        { text, locale: "de", format: "csv" },
        { limits: { ...DEFAULT_DELIMITED_LIMITS, maxFieldsPerRow: 12 } },
      ),
    ).toThrow(/maximum of 12 fields/);
  });
});
