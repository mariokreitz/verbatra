import { describe, expect, it } from "vitest";
import { buildWorkbook } from "./build-workbook.js";
import { ExchangeError } from "./errors.js";
import { readWorkbook } from "./read-workbook.js";
import type { WorkbookModel } from "./types.js";

const model: WorkbookModel = {
  sheets: [
    {
      locale: "de",
      rows: [
        {
          key: "greeting",
          source: "Hello {name}",
          currentTarget: "",
          status: "new",
          sourceHash: "abc123",
          translation: "",
        },
        {
          key: "farewell",
          source: "Bye",
          currentTarget: "Tschuss",
          status: "changed",
          sourceHash: "def456",
          translation: "",
        },
        {
          key: "welcome",
          source: "Welcome",
          currentTarget: "Willkommen",
          status: "unchanged",
          sourceHash: "ghi789",
          translation: "",
        },
      ],
    },
    { locale: "fr", rows: [] },
  ],
};

describe("buildWorkbook + readWorkbook round trip", () => {
  it("produces bytes that read back to the same sheets and keys (no instructions sheet)", async () => {
    const bytes = await buildWorkbook(model);
    expect(bytes.byteLength).toBeGreaterThan(0);

    const data = await readWorkbook(bytes);
    expect(data.sheets.map((s) => s.locale)).toEqual(["de", "fr"]);
    const de = data.sheets[0];
    expect(de?.rows.map((r) => r.key)).toEqual(["greeting", "farewell", "welcome"]);
    expect(de?.rows[0]?.source).toBe("Hello {name}");
    expect(de?.rows[0]?.sourceHash).toBe("abc123");
    expect(de?.rows[1]?.status).toBe("changed");
    expect(de?.rows[1]?.currentTarget).toBe("Tschuss");
    expect(de?.rows[2]?.status).toBe("unchanged");
    expect(de?.rows[2]?.currentTarget).toBe("Willkommen");
    // Empty translations stay empty on read.
    expect(de?.rows.every((r) => r.translation === "")).toBe(true);
  });

  it("round-trips a filled translation by key", async () => {
    const filled: WorkbookModel = {
      sheets: [
        {
          locale: "de",
          rows: [
            {
              key: "greeting",
              source: "Hello {name}",
              currentTarget: "",
              status: "new",
              sourceHash: "abc123",
              translation: "Hallo {name}",
            },
          ],
        },
      ],
    };
    const data = await readWorkbook(await buildWorkbook(filled));
    expect(data.sheets[0]?.rows[0]?.translation).toBe("Hallo {name}");
  });

  it("an empty workbook (no rows) still builds and reads zero data rows", async () => {
    const empty: WorkbookModel = { sheets: [{ locale: "de", rows: [] }] };
    const data = await readWorkbook(await buildWorkbook(empty));
    expect(data.sheets).toHaveLength(1);
    expect(data.sheets[0]?.rows).toHaveLength(0);
  });

  it("rejects non-xlsx bytes as a structured WORKBOOK_INVALID", async () => {
    const error = await readWorkbook(new Uint8Array([1, 2, 3, 4])).catch((e) => e);
    expect(error).toBeInstanceOf(ExchangeError);
    expect((error as ExchangeError).code).toBe("WORKBOOK_INVALID");
  });
});

/**
 * Translation values that Excel's default "General" number format would coerce or misparse if the
 * translation column were not formatted as text: a leading-zero code, a trailing-zero decimal, a
 * slash date, a long numeric id, a boolean-looking word, and each of the leading characters
 * (=, +, -, @) Excel treats as the start of a formula.
 */
const COERCION_PRONE_TRANSLATIONS: readonly string[] = [
  "007",
  "1.10",
  "3/4",
  "1234567890123456",
  "true",
  "=> siehe Hinweis",
  "+49 30 1234567",
  "-5 Grad",
  "@mention this",
];

describe("buildWorkbook + readWorkbook round trip: coercion-prone translations", () => {
  it.each(COERCION_PRONE_TRANSLATIONS)("imports %j verbatim", async (translation) => {
    const coercionModel: WorkbookModel = {
      sheets: [
        {
          locale: "de",
          rows: [
            {
              key: "value",
              source: "Source",
              currentTarget: "",
              status: "new",
              sourceHash: "abc123",
              translation,
            },
          ],
        },
      ],
    };
    const data = await readWorkbook(await buildWorkbook(coercionModel));
    expect(data.sheets[0]?.rows[0]?.translation).toBe(translation);
  });
});
