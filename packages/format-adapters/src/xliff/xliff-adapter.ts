import type { FormatAdapter } from "../adapter.js";
import { createFlatFileAdapter } from "../flat/flat-file-adapter.js";
import { extractXliffPlaceholders } from "./placeholders.js";
import { parseXliffEntries, serializeXliffEntries } from "./xml.js";

function sniffXliff(sample: string): boolean {
  const head = sample.trimStart();
  return head.startsWith("<xliff") || head.startsWith("<?xml");
}

export function createXliffAdapter(): FormatAdapter {
  return createFlatFileAdapter({
    format: "xliff",
    extensions: [".xlf", ".xliff"],
    sniff: sniffXliff,
    parseEntries: parseXliffEntries,
    serializeEntries: serializeXliffEntries,
    extractPlaceholders: extractXliffPlaceholders,
  });
}
