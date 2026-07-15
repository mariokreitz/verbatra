import { keyIntegrity } from "@verbatra/sdk";
import type { KeyIntegrityLocaleResult } from "../../shared/rpc/key-integrity.js";
import type { RpcHandler } from "../rpc.js";

/**
 * Wraps the sdk's read-only `keyIntegrity`, scoped to exactly the one key the caller specifies:
 * for each requested (or, by default, every configured) target locale where that key is
 * currently "changed", it runs the format's placeholder or ICU integrity check and reports the
 * result. Reads the config resolved once at startup, but re-reads the source, target, and lock
 * file from disk on every call, matching `status.diff`.
 *
 * A locale where the key is not "changed" (missing, orphaned, already in sync, or simply unknown)
 * is absent from the result rather than reported as a false pass or fail. The result never carries
 * a full source or target string value, only the boolean match result and, on a mismatch, the
 * specific placeholder tokens involved.
 */
export const keyIntegrityHandler: RpcHandler<"key.integrity"> = async (params, deps) => {
  const results = await keyIntegrity({
    config: deps.config.config,
    cwd: deps.projectRoot,
    keys: [params.key],
    ...(params.locales !== undefined ? { locales: params.locales } : {}),
  });

  const locales: KeyIntegrityLocaleResult[] = [];
  for (const locale of results) {
    const entry = locale.entries[0];
    if (entry === undefined) {
      continue;
    }
    locales.push({
      locale: locale.locale,
      hasPlaceholders: entry.hasPlaceholders,
      matches: entry.matches,
      missing: entry.missing,
      extra: entry.extra,
      icuValid: entry.icuValid,
    });
  }
  return { locales };
};
