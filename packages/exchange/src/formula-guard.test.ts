import { describe, expect, it } from "vitest";
import { escapeFormulaLead, unescapeFormulaLead } from "./formula-guard.js";

const VALUES: readonly string[] = [
  "",
  "plain text",
  "=1+1",
  "+49",
  "-5",
  "@mention",
  "'=1+1",
  "''=1+1",
  "'tis fine",
  "'",
  " =1+1",
  "a=1+1",
  "\t=1+1",
  "\r=1+1",
  "\ttab lead",
  "\rcarriage return lead",
  "'\t=1+1",
  "'\r=1+1",
  "\t",
  "\r",
];

describe("formula-guard", () => {
  it.each(VALUES)("unescaping the escaped form of %j restores it exactly", (value) => {
    expect(unescapeFormulaLead(escapeFormulaLead(value))).toBe(value);
  });

  it.each(["=1+1", "+49", "-5", "@mention", "'=1+1"])(
    "escapes %j so no spreadsheet lead survives unquoted",
    (value) => {
      expect(escapeFormulaLead(value).startsWith("'")).toBe(true);
    },
  );

  it.each(["\t=1+1", "\r=1+1", "\ttab lead", "\rcarriage return lead", "'\t=1+1", "'\r=1+1"])(
    "escapes %j because a spreadsheet importer strips a leading tab or carriage return before parsing",
    (value) => {
      expect(escapeFormulaLead(value).startsWith("'")).toBe(true);
    },
  );

  it.each(["", "plain text", "'tis fine", " =1+1", "a=1+1"])("leaves %j untouched", (value) => {
    expect(escapeFormulaLead(value)).toBe(value);
  });

  it("leaves a leading space untouched, since only tab and carriage return joined the guard", () => {
    expect(escapeFormulaLead(" =1+1")).toBe(" =1+1");
    expect(escapeFormulaLead(" ")).toBe(" ");
  });

  it("leaves an unescaped formula lead alone on read, so an older export is unchanged", () => {
    expect(unescapeFormulaLead("=1+1")).toBe("=1+1");
  });
});
