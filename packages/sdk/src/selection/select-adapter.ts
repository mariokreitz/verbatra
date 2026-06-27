import { SUPPORTED_FORMATS, type SupportedFormat } from "@verbatra/core";
import {
  type AdapterRegistry,
  createDefaultRegistry,
  type FormatAdapter,
} from "@verbatra/format-adapters";
import { SdkError } from "../errors.js";

/**
 * Select the adapter for the configured format from the registry by explicit format (never content
 * sniffing). An unregistered format yields a structured error before any file is read.
 */
export function selectAdapter(
  format: SupportedFormat,
  registry: AdapterRegistry = createDefaultRegistry(),
): FormatAdapter {
  const resolution = registry.resolve("", { format });
  if (resolution.status === "resolved") {
    return resolution.adapter;
  }
  throw new SdkError(
    "UNKNOWN_FORMAT",
    `No adapter is registered for format "${format}". Supported formats: ${SUPPORTED_FORMATS.join(", ")}.`,
  );
}
