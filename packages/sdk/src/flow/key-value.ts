import type { AdapterRegistry } from "@verbatra/format-adapters";
import type { VerbatraConfig } from "../config/schema.js";
import { SdkError } from "../errors.js";
import { defaultFs, type SdkFs } from "../fs.js";
import { selectAdapter } from "../selection/select-adapter.js";
import { readTarget } from "./diff-locales.js";
import { selectLocales } from "./select-locales.js";
import { readSource } from "./source.js";

export interface KeyValueInput {
  readonly config: VerbatraConfig;
  readonly cwd?: string;
  readonly locale: string;
  readonly key: string;
}

export interface KeyValueDeps {
  readonly adapterRegistry?: AdapterRegistry;
  readonly fs?: SdkFs;
}

export interface KeyValueResult {
  readonly source: string;
  readonly target?: string;
}

export async function keyValue(
  input: KeyValueInput,
  deps: KeyValueDeps = {},
): Promise<KeyValueResult> {
  const config = input.config;
  const cwd = input.cwd ?? process.cwd();
  const fs = deps.fs ?? defaultFs;
  const adapter = selectAdapter(config.format, deps.adapterRegistry);

  const [locale] = selectLocales(config, [input.locale]);
  /* v8 ignore next 3 -- selectLocales with a one-element requested array either throws UNKNOWN_LOCALE or returns that exact element; `locale` is never undefined here. */
  if (locale === undefined) {
    throw new SdkError("UNKNOWN_LOCALE", `Locale "${input.locale}" could not be resolved.`);
  }

  const source = await readSource(config, cwd, fs, adapter);
  const sourceEntry = source.resource.entries.get(input.key);
  if (sourceEntry === undefined) {
    throw new SdkError(
      "UNKNOWN_KEY",
      `The key "${input.key}" was not found in the source resource.`,
    );
  }

  const target = await readTarget(cwd, config, adapter, fs, locale);
  const targetEntry = target.entries.get(input.key);

  return {
    source: sourceEntry.value,
    ...(targetEntry !== undefined ? { target: targetEntry.value } : {}),
  };
}
