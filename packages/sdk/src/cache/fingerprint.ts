import { stableStringHash } from "@verbatra/core";
import type { ProviderConfig } from "../config/provider-config.js";
import type { VerbatraConfig } from "../config/schema.js";

/**
 * The provider's model as it enters the fingerprint, or null when the provider has none (DeepL). Read
 * structurally so every model-bearing provider contributes it without restating the union branch by
 * branch.
 */
function fingerprintModel(provider: ProviderConfig): string | null {
  const options: Record<string, unknown> = provider.options;
  const model = options.model;
  return typeof model === "string" ? model : null;
}

/** Glossary keys sorted so a re-ordering of the same terms yields the same fingerprint. */
function sortGlossary(
  glossary: Readonly<Record<string, string>> | undefined,
): Record<string, string> {
  if (glossary === undefined) {
    return {};
  }
  return Object.fromEntries(Object.entries(glossary).sort(([a], [b]) => (a < b ? -1 : 1)));
}

/**
 * The stable cache fingerprint for a run: a short hash over the translation context that a cached
 * value must match to be reused. It covers the provider id, the model, the tone, and the resolved
 * glossary (keys sorted), so a change to any of them (a different tone, an edited glossary) makes
 * every prior entry a miss rather than serving it stale.
 *
 * The format is deliberately excluded: the integrity gate re-checks every hit against the current
 * adapter, so a format change degrades to a cache miss rather than a wrong write. The serialization
 * only needs to be stable within one machine across runs, not byte-identical across platforms (the
 * cache never leaves the machine), so `JSON.stringify` with a sorted glossary suffices.
 *
 * @param config - The resolved run configuration (its glossary is already a plain record here).
 * @returns A 16-character hex fingerprint.
 */
export function computeFingerprint(config: VerbatraConfig): string {
  const canonical = JSON.stringify({
    provider: config.provider.id,
    model: fingerprintModel(config.provider),
    tone: config.tone ?? null,
    glossary: sortGlossary(config.glossary),
  });
  return stableStringHash(canonical);
}
