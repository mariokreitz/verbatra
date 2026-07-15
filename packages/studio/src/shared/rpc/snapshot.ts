import type { ProviderId, SupportedFormat } from "@verbatra/sdk";
import { z } from "zod";
import type { GlossaryIndicator } from "./glossary.js";

/** The RPC method name for the project configuration snapshot. */
export const PROJECT_SNAPSHOT_METHOD = "project.snapshot";

/** Takes no parameters: the snapshot always reflects the single loaded project. */
export const projectSnapshotParamsSchema = z.strictObject({});

export type ProjectSnapshotParams = z.infer<typeof projectSnapshotParamsSchema>;

/**
 * The two independent write permissions a server instance was started with, resolved once at
 * process start (CLI flags or their environment variable fallback) and never re-derived or
 * RPC-toggleable afterward. `spend` authorizes a provider invocation; `writeToDisk` authorizes
 * mutating a source-controlled locale file and its lock entry. Sized for both the current
 * (`retranslateEntry`, requires both) and a future (`editEntry`, requires only `writeToDisk`)
 * write seam, even though only the former exists today.
 */
export interface StudioCapabilities {
  readonly spend: boolean;
  readonly writeToDisk: boolean;
}

/**
 * The read-only, allowlisted projection of the loaded config (see the config projection
 * allowlist rule): never the raw config object, never provider options or secrets, and only
 * fields the config actually sets. `configSource` is the config file path relativized against the
 * project root, or the literal "override" when the config was supplied in memory.
 *
 * `capabilities` is a read-only, defense-in-depth projection of the server's own resolved
 * {@link StudioCapabilities}: the client uses it only to hide a write affordance the server would
 * refuse anyway (an absent handler answers `METHOD_UNKNOWN`), never to authorize a call. It is
 * never the authoritative gate.
 */
export interface ProjectSnapshotResult {
  readonly sourceLocale: string;
  readonly targetLocales: readonly string[];
  readonly format: SupportedFormat;
  readonly files: { readonly pattern: string };
  readonly provider: { readonly id: ProviderId };
  readonly configSource: string;
  readonly glossary: GlossaryIndicator;
  readonly capabilities: StudioCapabilities;
  readonly prune?: boolean;
  readonly generatePlurals?: boolean;
  readonly maxBatchSize?: number;
  readonly tone?: "formal" | "informal" | "neutral";
}
