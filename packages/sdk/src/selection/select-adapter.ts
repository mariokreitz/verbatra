import { SUPPORTED_FORMATS, type SupportedFormat } from "@verbatra/core";
import {
  type AdapterRegistry,
  createDefaultRegistry,
  type FormatAdapter,
} from "@verbatra/format-adapters";
import { SdkError } from "../errors.js";

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
