import { relative } from "node:path";
import type { LoadedConfig } from "@verbatra/sdk";
import type { GlossaryIndicator } from "../shared/rpc/glossary.js";
import type { ProjectSnapshotResult } from "../shared/rpc/snapshot.js";
import { redact } from "./redaction.js";

function projectConfigSource(source: LoadedConfig["source"], projectRoot: string): string {
  if (source.kind === "override") {
    return "override";
  }
  return redact(relative(projectRoot, source.filepath));
}

/**
 * Derives the glossary indicator from the loader's own {@link LoadedConfig.glossary} provenance
 * (never inferred from the config's shape), relativizing a file path against the project root the
 * same way {@link projectConfigSource} does. Shared by {@link buildProjectSnapshot} and the
 * `glossary.get` handler so the relativization logic exists in exactly one place.
 */
export function projectGlossaryIndicator(
  glossary: LoadedConfig["glossary"],
  projectRoot: string,
): GlossaryIndicator {
  if (glossary.source === "file") {
    return { source: "file", path: redact(relative(projectRoot, glossary.path)) };
  }
  return { source: glossary.source };
}

/**
 * Builds the allowlisted, read-only view of the loaded config a client is allowed to see (the
 * config projection allowlist rule): never the raw config object, never provider options or
 * secrets, and only fields the config actually sets (no synthesized defaults, for example a
 * default batch size). `format`, `provider.id`, and `tone` are closed enums fixed by the config
 * schema and are passed through as-is; they have no free-form capacity to carry a secret. Every
 * other projected string passes through the redaction backstop.
 */
export function buildProjectSnapshot(
  loaded: LoadedConfig,
  projectRoot: string,
): ProjectSnapshotResult {
  const { config } = loaded;
  return {
    sourceLocale: redact(config.sourceLocale),
    targetLocales: config.targetLocales.map((locale) => redact(locale)),
    format: config.format,
    files: { pattern: redact(config.files.pattern) },
    provider: { id: config.provider.id },
    configSource: projectConfigSource(loaded.source, projectRoot),
    glossary: projectGlossaryIndicator(loaded.glossary, projectRoot),
    ...(config.prune !== undefined ? { prune: config.prune } : {}),
    ...(config.generatePlurals !== undefined ? { generatePlurals: config.generatePlurals } : {}),
    ...(config.maxBatchSize !== undefined ? { maxBatchSize: config.maxBatchSize } : {}),
    ...(config.tone !== undefined ? { tone: config.tone } : {}),
  };
}
