import { ProviderError, type ReviewReasonCode } from "@verbatra/ai-providers";
import { contentHash } from "@verbatra/core";
import type { AdapterRegistry } from "@verbatra/format-adapters";
import { computeFingerprint } from "../cache/fingerprint.js";
import { feedTranslationMemory } from "../cache/translation-memory.js";
import type { VerbatraConfig } from "../config/schema.js";
import { SdkError } from "../errors.js";
import { defaultFs, type SdkFs } from "../fs.js";
import { createLocalePathResolver } from "../locale-path/resolver.js";
import { withLocaleWriteLock } from "../lock/locale-write-lock.js";
import { updateLockFileLocale } from "../lock/lock-file.js";
import { selectAdapter } from "../selection/select-adapter.js";
import { type CreateProvider, selectProvider } from "../selection/select-provider.js";
import { readTarget } from "./diff-locales.js";
import { gateCandidateValue, type IntegrityGateReason } from "./integrity-gate.js";
import { selectLocales } from "./select-locales.js";
import { readSource } from "./source.js";
import { buildTranslateRequest } from "./translate-request.js";

export interface RetranslateEntryInput {
  readonly config: VerbatraConfig;
  readonly cwd?: string;
  readonly locale: string;
  readonly key: string;
}

export interface RetranslateEntryDeps {
  readonly adapterRegistry?: AdapterRegistry;
  readonly createProvider?: CreateProvider;
  readonly fs?: SdkFs;
}

export type RetranslateEntryResult =
  | {
      readonly accepted: true;
      readonly value: string;
      readonly reviewReasons: readonly ReviewReasonCode[];
    }
  | {
      readonly accepted: false;
      readonly reason: IntegrityGateReason;
      readonly value: string;
    };

export async function retranslateEntry(
  input: RetranslateEntryInput,
  deps: RetranslateEntryDeps = {},
): Promise<RetranslateEntryResult> {
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

  const provider = selectProvider(config.provider, deps.createProvider);

  return withLocaleWriteLock(cwd, locale, fs, async () => {
    const target = await readTarget(cwd, config, adapter, fs, locale);

    const result = await provider.translateBatch(
      buildTranslateRequest(
        {
          sourceLocale: config.sourceLocale,
          targetLocale: locale,
          adapter,
          glossary: config.glossary,
          tone: config.tone,
        },
        [sourceEntry],
      ),
    );
    const value = result.values.get(input.key);
    if (value === undefined) {
      throw new ProviderError(
        "INVALID_RESPONSE",
        `The provider returned no translated value for key "${input.key}".`,
      );
    }

    const gate = gateCandidateValue(sourceEntry, value, adapter);
    if (!gate.accepted) {
      return { accepted: false, reason: gate.reason, value };
    }

    const merged = new Map(target.entries);
    merged.set(input.key, { ...sourceEntry, value, namespace: target.namespace });
    const path = createLocalePathResolver(cwd, config).pathFor(locale);
    await adapter.write(
      { locale, namespace: target.namespace, format: config.format, entries: merged },
      path,
    );

    await updateLockFileLocale(cwd, fs, locale, {
      mode: "merge",
      entries: { [input.key]: contentHash(sourceEntry) },
    });

    await feedTranslationMemory(
      cwd,
      fs,
      computeFingerprint(config),
      new Map([[locale, { [contentHash(sourceEntry)]: value }]]),
    );

    const reviewReasons = result.reviewFlags?.get(input.key)?.reasons ?? [];
    return { accepted: true, value, reviewReasons };
  });
}
