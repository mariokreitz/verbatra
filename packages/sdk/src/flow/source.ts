import type { FormatAdapter, ReadResult } from "@verbatra/format-adapters";
import type { VerbatraConfig } from "../config/schema.js";
import { errorMessage, SdkError } from "../errors.js";
import type { SdkFs } from "../fs.js";
import { createLocalePathResolver, type LocalePathResolver } from "../locale-path/resolver.js";

/**
 * The single tolerant source-read core: reads the source locale file through an already-built
 * resolver. An absent file is a structured `SOURCE_UNREADABLE`; an unreadable or invalid file is a
 * structured `SOURCE_INVALID` wrapping the adapter's read error. Every flow that reads the source
 * delegates here, directly when it already holds a resolver, or through {@link readSource} when it
 * does not, so the existence check and error wording can never drift apart.
 */
export async function readSourceResource(
  config: VerbatraConfig,
  resolver: LocalePathResolver,
  fs: SdkFs,
  adapter: FormatAdapter,
): Promise<ReadResult> {
  const sourcePath = resolver.pathFor(config.sourceLocale);
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

/**
 * Read the source locale file into core's IR, building a fresh resolver from `cwd` and `config`. A
 * convenience wrapper over {@link readSourceResource} for a caller that does not already hold a
 * resolver; a caller that does (for example a per-locale run, or a loop over several target
 * locales that also needs the resolver) should call {@link readSourceResource} directly instead of
 * building a second, redundant one here.
 */
export async function readSource(
  config: VerbatraConfig,
  cwd: string,
  fs: SdkFs,
  adapter: FormatAdapter,
): Promise<ReadResult> {
  return readSourceResource(config, createLocalePathResolver(cwd, config), fs, adapter);
}
