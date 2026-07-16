import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Static, durable stand-in for acceptance criterion 17 of the needs-review-queue spec ("no file
 * under packages/exchange, and no line in export-workbook.ts or import-workbook.ts, changes as
 * part of this ticket"). That literal, git-history claim can only be checked once, at review time
 * (and was); it cannot be expressed as a permanent runtime invariant, since after merge "as part
 * of this ticket" stops being a meaningful predicate and the exchange package will legitimately
 * change in later work. What can be checked forever is the property that actually matters: this
 * ticket's new SDK seam files never import the exchange/workbook surface, so the feature cannot
 * have silently reached into it.
 */
describe("static proof: the needs-review-queue SDK seam never imports exchange or workbook", () => {
  const seamFiles = [
    fileURLToPath(new URL("./edit-entry.ts", import.meta.url)),
    fileURLToPath(new URL("./key-value.ts", import.meta.url)),
  ];

  for (const path of seamFiles) {
    const content = readFileSync(path, "utf8");
    const name = path.split("/").at(-1);

    it(`${name} never imports @verbatra/exchange`, () => {
      expect(content).not.toContain("@verbatra/exchange");
    });

    it(`${name} never imports a workbook module`, () => {
      expect(content).not.toContain("/workbook/");
      expect(content).not.toContain("workbook.js");
    });
  }
});
