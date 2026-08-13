import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

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
