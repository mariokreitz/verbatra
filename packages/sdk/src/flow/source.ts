import type { FormatAdapter, ReadResult } from "@verbatra/format-adapters";
import type { VerbatraConfig } from "../config/schema.js";
import { SdkError } from "../errors.js";
import type { SdkFs } from "../fs.js";
import { localeFilePath } from "../paths.js";

/**
 * Read the source locale file into core's IR. An absent file is a structured `SOURCE_UNREADABLE`; an
 * unreadable or invalid file is a structured `SOURCE_INVALID` wrapping the adapter's read error.
 */
export async function readSource(
  config: VerbatraConfig,
  cwd: string,
  fs: SdkFs,
  adapter: FormatAdapter,
): Promise<ReadResult> {
  const sourcePath = localeFilePath(cwd, config.files.pattern, config.sourceLocale);
  if (!(await fs.fileExists(sourcePath))) {
    throw new SdkError(
      "SOURCE_UNREADABLE",
      `The source locale file was not found at ${sourcePath}.`,
    );
  }
  try {
    return await adapter.read(sourcePath, config.sourceLocale);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new SdkError(
      "SOURCE_INVALID",
      `The source locale file at ${sourcePath} could not be read: ${detail}`,
    );
  }
}
