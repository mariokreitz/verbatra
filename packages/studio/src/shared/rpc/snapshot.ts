import type { ProviderId, SupportedFormat } from "@verbatra/sdk";
import { z } from "zod";
import type { GlossaryIndicator } from "./glossary.js";

/** The RPC method name for the project configuration snapshot. */
export const PROJECT_SNAPSHOT_METHOD = "project.snapshot";

/** Takes no parameters: the snapshot always reflects the single loaded project. */
export const projectSnapshotParamsSchema = z.strictObject({});

/** Parsed `project.snapshot` params. */
export type ProjectSnapshotParams = z.infer<typeof projectSnapshotParamsSchema>;

/**
 * The write permissions a server instance runs with. `spend` authorizes a provider invocation
 * (`translation.retranslateEntry` and `translation.translatePending` are registered only when it
 * is true); it is resolved once at process start (CLI flag or its environment variable fallback)
 * and never re-derived or RPC-toggleable afterward. `writeToDisk` (mutating a local locale file
 * and its lock entry, the seam behind `translation.editEntry` and `key.value`) is always `true`:
 * local editing needs no flag. The field is kept so clients keep one stable capabilities shape.
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
