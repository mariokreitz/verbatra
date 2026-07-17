import { keyIntegrity } from "@verbatra/sdk";
import type { KeyIntegrityLocaleResult } from "../../shared/rpc/key-integrity.js";
import type { RpcHandler } from "../rpc.js";

/**
 * Handles `key.integrity`: runs the sdk's read-only `keyIntegrity` for exactly the one key the
 * caller specifies, across the requested (or by default every configured) target locale, and
 * maps each per-locale result to the RPC shape. A locale whose result carries no entry for the
 * key is absent from the response rather than reported as a false pass or fail. The response
 * never carries a full source or target string value, only the boolean outcomes and the
 * placeholder tokens involved.
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
