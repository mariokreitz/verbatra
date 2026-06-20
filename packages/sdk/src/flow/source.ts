import type { FormatAdapter, ReadResult } from "@verbatra/format-adapters";
import type { VerbatraConfig } from "../config/schema.js";
import { SdkError } from "../errors.js";
import type { SdkFs } from "../fs.js";
import { localeFilePath } from "../paths.js";

/**
 * Read the source locale file into core's IR, the single shared entry both the translate flow and
 * the workbook export/import flows use. An absent file is a structured `SOURCE_UNREADABLE`; an
 * unreadable or invalid file is a structured `SOURCE_INVALID` wrapping the adapter's read error.
 *
 * @param config - The validated config (for the source locale and file pattern).
 * @param cwd - The directory the file pattern resolves against.
 * @param fs - The file system seam (existence check).
 * @param adapter - The selected format adapter (does the actual read).
 * @returns The source {@link ReadResult} (resource plus invalid-ICU keys).
 * @throws {@link SdkError} `SOURCE_UNREADABLE` when the source file is absent.
 * @throws {@link SdkError} `SOURCE_INVALID` when the source file cannot be read or parsed.
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
