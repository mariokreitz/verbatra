import type { ProviderId, SupportedFormat } from "@verbatra/sdk";
import { z } from "zod";
import type { GlossaryIndicator } from "./glossary.js";

/** The RPC method name for the project configuration snapshot. */
export const PROJECT_SNAPSHOT_METHOD = "project.snapshot";

/** Takes no parameters: the snapshot always reflects the single loaded project. */
export const projectSnapshotParamsSchema = z.strictObject({});

export type ProjectSnapshotParams = z.infer<typeof projectSnapshotParamsSchema>;

/**
 * The read-only, allowlisted projection of the loaded config (see the config projection
 * allowlist rule): never the raw config object, never provider options or secrets, and only
 * fields the config actually sets. `configSource` is the config file path relativized against the
 * project root, or the literal "override" when the config was supplied in memory.
 */
export interface ProjectSnapshotResult {
  readonly sourceLocale: string;
  readonly targetLocales: readonly string[];
  readonly format: SupportedFormat;
  readonly files: { readonly pattern: string };
  readonly provider: { readonly id: ProviderId };
  readonly configSource: string;
  readonly glossary: GlossaryIndicator;
  readonly prune?: boolean;
  readonly generatePlurals?: boolean;
  readonly maxBatchSize?: number;
  readonly tone?: "formal" | "informal" | "neutral";
}
