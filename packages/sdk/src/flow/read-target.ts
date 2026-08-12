import type { LocaleResource, SupportedFormat } from "@verbatra/core";
import type { FormatAdapter } from "@verbatra/format-adapters";
import type { SdkFs } from "../fs.js";
import type { LocalePathResolver } from "../locale-path/resolver.js";

/**
 * Narrow inputs for the tolerant target read: just the resolver, format, and locale, so flows that
 * hold no full config (the per-locale translate run) can delegate without one.
 */
export interface ReadTargetResourceInput {
  /** The project's locale-to-path resolver, already validated against the config. */
  readonly resolver: LocalePathResolver;
  /** The configured format, stamped onto the empty resource when the file does not exist. */
  readonly format: SupportedFormat;
  /** The target locale to read. */
  readonly locale: string;
  readonly adapter: FormatAdapter;
  readonly fs: SdkFs;
}

/**
 * The single tolerant target-read core: a locale's existing target resource, or an empty resource
 * when the file does not exist. Every flow that reads a target locale delegates here (directly, or
 * through `readTarget` in `diff-locales.ts`) so the empty-resource shape and the existence check
 * can never drift apart.
 */
export async function readTargetResource(input: ReadTargetResourceInput): Promise<LocaleResource> {
  const path = input.resolver.pathFor(input.locale);
  if (!(await input.fs.fileExists(path))) {
    return { locale: input.locale, namespace: "", format: input.format, entries: new Map() };
  }
  return (await input.adapter.read(path, input.locale)).resource;
}
