import type { FormatAdapter, ReadResult } from "@verbatra/format-adapters";
import type { VerbatraConfig } from "../config/schema.js";
import { errorMessage, SdkError } from "../errors.js";
import type { SdkFs } from "../fs.js";
import { createLocalePathResolver } from "../locale-path/resolver.js";

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
  const sourcePath = createLocalePathResolver(cwd, config).pathFor(config.sourceLocale);
  if (!(await fs.fileExists(sourcePath))) {
    throw new SdkError(
      "SOURCE_UNREADABLE",
      `The source locale file was not found at ${sourcePath}.`,
    );
  }
  try {
    return await adapter.read(sourcePath, config.sourceLocale);
  } catch (error) {
    const detail = errorMessage(error);
    throw new SdkError(
      "SOURCE_INVALID",
      `The source locale file at ${sourcePath} could not be read: ${detail}`,
    );
  }
}
