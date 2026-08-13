import type { LocaleResource, SupportedFormat } from "@verbatra/core";
import type { FormatAdapter } from "@verbatra/format-adapters";
import type { SdkFs } from "../fs.js";
import type { LocalePathResolver } from "../locale-path/resolver.js";

export interface ReadTargetResourceInput {
  readonly resolver: LocalePathResolver;
  readonly format: SupportedFormat;
  readonly locale: string;
  readonly adapter: FormatAdapter;
  readonly fs: SdkFs;
}

export async function readTargetResource(input: ReadTargetResourceInput): Promise<LocaleResource> {
  const path = input.resolver.pathFor(input.locale);
  if (!(await input.fs.fileExists(path))) {
    return { locale: input.locale, namespace: "", format: input.format, entries: new Map() };
  }
  return (await input.adapter.read(path, input.locale)).resource;
}
