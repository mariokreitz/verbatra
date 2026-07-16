import { contentHash } from "@verbatra/core";
import type { AdapterRegistry } from "@verbatra/format-adapters";
import type { VerbatraConfig } from "../config/schema.js";
import { SdkError } from "../errors.js";
import { defaultFs, type SdkFs } from "../fs.js";
import { withLocaleWriteLock } from "../lock/locale-write-lock.js";
import { updateLockFileLocale } from "../lock/lock-file.js";
import { localeFilePath } from "../paths.js";
import { selectAdapter } from "../selection/select-adapter.js";
import { readTarget } from "./diff-locales.js";
import { gateCandidateValue } from "./integrity-gate.js";
import { selectLocales } from "./select-locales.js";
import { readSource } from "./source.js";

/** Input for {@link editEntry}: the validated config, exactly one target locale/key pair, and the human-typed replacement value. */
export interface EditEntryInput {
  /** The validated configuration (typically from {@link loadConfig}). */
  readonly config: VerbatraConfig;
  /** Directory the file pattern and lock-file resolve against; defaults to cwd. */
  readonly cwd?: string;
  /** The target locale to write the correction into. Must be a configured target locale. */
  readonly locale: string;
  /** The source key being corrected. Must exist in the source resource. */
  readonly key: string;
  /** The human-typed replacement value. */
  readonly value: string;
}

/** Composition seam for {@link editEntry}: inject a registry and a file system for tests. No provider builder: this seam never calls a provider. */
export interface EditEntryDeps {
  readonly adapterRegistry?: AdapterRegistry;
  readonly fs?: SdkFs;
}

/**
 * The two-armed result of one edit attempt: `accepted` carries the newly written value; a
 * rejection carries the candidate value and which {@link gateCandidateValue} check failed it,
 * without writing anything. Deliberately has no `reviewReasons` field (unlike
 * {@link RetranslateEntryResult}): a human-typed correction never touches a provider, so there is
 * no provider-derived review signal to report.
 */
export type EditEntryResult =
  | {
      readonly accepted: true;
      readonly value: string;
    }
  | {
      readonly accepted: false;
      readonly reason: "placeholder" | "icu";
      readonly value: string;
    };

/**
 * Write exactly one human-typed correction for exactly one target locale, gated through the shared
 * {@link gateCandidateValue} before anything reaches disk. On acceptance, writes the target locale
 * file (merging just this one key into its current entries, every other key untouched) and updates
 * the lock entry for this key only (see {@link updateLockFileLocale}'s `"merge"` mode); on
 * rejection, writes nothing. Never calls a provider: {@link EditEntryDeps} has no `createProvider`
 * field, so there is no way to construct or call one even if this handler were miswired.
 *
 * `locale` and `key` are resolved fresh on every call, never cached: `locale` against
 * `config.targetLocales` (the existing `UNKNOWN_LOCALE`), `key` against the source resource's own
 * keys, read fresh from disk (`UNKNOWN_KEY`), via a `Map`-backed lookup, never `key in obj` or
 * `obj[key] !== undefined` against a plain object. This mirrors {@link retranslateEntry} exactly.
 *
 * @param input - The validated config, the target locale, the source key, and the replacement value.
 * @param deps - Optional composition seams (registry, file system) for tests.
 * @returns The two-armed {@link EditEntryResult}.
 * @throws {@link SdkError} `UNKNOWN_FORMAT`: no adapter is registered for the configured format.
 * @throws {@link SdkError} `UNKNOWN_LOCALE`: `locale` is not among `config.targetLocales`.
 * @throws {@link SdkError} `SOURCE_UNREADABLE` / `SOURCE_INVALID`: the source locale file is absent
 *   or unreadable.
 * @throws {@link SdkError} `UNKNOWN_KEY`: `key` does not exist in the source resource.
 * @throws {@link SdkError} `LOCK_FILE_INVALID`: the lock-file is corrupt, oversized, or at an
 *   unsupported version.
 * @throws {@link SdkError} `LOCK_CONTENDED`: this locale's write lock could not be acquired before
 *   its timeout, because another process (another CLI run, or a second Studio write) is holding it.
 *
 * The target-file write and the lock-file update run inside the same held
 * `withLocaleWriteLock(cwd, locale, fs, ...)` critical section, so no second writer for this
 * locale can ever observe the target file updated but the lock entry not yet, or vice versa.
 * Reading the source, resolving the key, and adapter selection stay outside the lock: they are
 * read-only or pure construction and do not need protection, mirroring `retranslateEntry`'s own
 * split exactly.
 *
 * Never writes to, or reads for the purpose of updating, `.verbatra-local/run-status.json`: that
 * file is written only by `translate()`/`watch()` after their whole per-locale loop, outside any
 * locale lock, so a patching `editEntry` would be a second, unlocked writer racing that wholesale
 * rewrite. A key edited here stays stale in that persisted snapshot until the next real
 * `translate()`/`watch()` run, which self-heals it for free since this call already advanced the
 * lock hash.
 */
export async function editEntry(
  input: EditEntryInput,
  deps: EditEntryDeps = {},
): Promise<EditEntryResult> {
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

  return withLocaleWriteLock(cwd, locale, fs, async () => {
    const target = await readTarget(cwd, config, adapter, fs, locale);

    const gate = gateCandidateValue(sourceEntry, input.value, adapter);
    if (!gate.accepted) {
      return { accepted: false, reason: gate.reason, value: input.value };
    }

    const merged = new Map(target.entries);
    merged.set(input.key, { ...sourceEntry, value: input.value, namespace: target.namespace });
    const path = localeFilePath(cwd, config.files.pattern, locale);
    await adapter.write(
      { locale, namespace: target.namespace, format: config.format, entries: merged },
      path,
    );

    await updateLockFileLocale(cwd, fs, locale, {
      mode: "merge",
      entries: { [input.key]: contentHash(sourceEntry) },
    });

    return { accepted: true, value: input.value };
  });
}
