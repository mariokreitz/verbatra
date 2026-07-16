import type { AdapterRegistry } from "@verbatra/format-adapters";
import type { VerbatraConfig } from "../config/schema.js";
import { SdkError } from "../errors.js";
import { defaultFs, type SdkFs } from "../fs.js";
import { selectAdapter } from "../selection/select-adapter.js";
import { readTarget } from "./diff-locales.js";
import { selectLocales } from "./select-locales.js";
import { readSource } from "./source.js";

/** Input for {@link keyValue}: the validated config and exactly one target locale/key pair. */
export interface KeyValueInput {
  /** The validated configuration (typically from {@link loadConfig}). */
  readonly config: VerbatraConfig;
  /** Directory the file pattern resolves against; defaults to cwd. */
  readonly cwd?: string;
  /** The target locale to read the current translation from. Must be a configured target locale. */
  readonly locale: string;
  /** The source key to read. Must exist in the source resource. */
  readonly key: string;
}

/** Composition seam for {@link keyValue}: inject a registry and a file system for tests. */
export interface KeyValueDeps {
  readonly adapterRegistry?: AdapterRegistry;
  readonly fs?: SdkFs;
}

/**
 * The current source and target values for one key/locale pair. `target` is absent exactly when
 * the key does not yet exist in that target locale; a present-but-empty-string target is a real
 * value and is returned as such.
 */
export interface KeyValueResult {
  readonly source: string;
  readonly target?: string;
}

/**
 * Reads a key's current source and target values for exactly one target locale. Read-only: it
 * calls no provider, writes no file, and mutates nothing. Exposes only the current values on disk,
 * never a previous one.
 *
 * `locale` and `key` are resolved fresh on every call, so a caller feeding an edit dialog with
 * this result and then submitting through `editEntry` is always working from live data, never a
 * cached snapshot.
 *
 * @param input - The validated config, the target locale, and the source key to read.
 * @param deps - Optional composition seams (registry, file system) for tests.
 * @returns The current source value and, when present, the current target value.
 * @throws {@link SdkError} `UNKNOWN_FORMAT`: no adapter is registered for the configured format.
 * @throws {@link SdkError} `UNKNOWN_LOCALE`: `locale` is not among `config.targetLocales`.
 * @throws {@link SdkError} `SOURCE_UNREADABLE` / `SOURCE_INVALID`: the source locale file is absent
 *   or unreadable.
 * @throws {@link SdkError} `UNKNOWN_KEY`: `key` does not exist in the source resource.
 */
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
