import { relative } from "node:path";
import type { LoadedConfig } from "@verbatra/sdk";
import type { GlossaryIndicator } from "../shared/rpc/glossary.js";
import type { ProjectSnapshotResult, StudioCapabilities } from "../shared/rpc/snapshot.js";
import { redact } from "./redaction.js";

function projectConfigSource(source: LoadedConfig["source"], projectRoot: string): string {
  if (source.kind === "override") {
    return "override";
  }
  return redact(relative(projectRoot, source.filepath));
}

/**
 * Projects the glossary indicator from the loader's {@link LoadedConfig.glossary} provenance. A
 * file-sourced glossary gets its path relativized against the project root and redacted; every
 * other source is passed through as its bare `source` tag. Shared by {@link buildProjectSnapshot}
 * and the `glossary.get` handler so the relativization exists in one place.
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
 * Builds the allowlisted, read-only view of the loaded config a client may see: never the raw
 * config object, never provider options, and only optional fields the config actually sets (no
 * synthesized defaults). `format`, `provider.id`, and `tone` are closed enums fixed by the config
 * schema and pass through as-is; every other projected string passes through the redaction
 * backstop.
 *
 * @param capabilities - The server's resolved capabilities, projected verbatim as a client hint;
 *   never the authoritative gate.
 * @param exposeAgentTools - The resolved opt-in the client reads to decide whether to register the
 *   WebMCP agent tools; a client rendering hint only, never a server gate.
 */
export function buildProjectSnapshot(
  loaded: LoadedConfig,
  projectRoot: string,
  capabilities: StudioCapabilities,
  exposeAgentTools: boolean,
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
    capabilities,
    exposeAgentTools,
    ...(config.prune !== undefined ? { prune: config.prune } : {}),
    ...(config.generatePlurals !== undefined ? { generatePlurals: config.generatePlurals } : {}),
    ...(config.maxBatchSize !== undefined ? { maxBatchSize: config.maxBatchSize } : {}),
    ...(config.tone !== undefined ? { tone: config.tone } : {}),
  };
}
