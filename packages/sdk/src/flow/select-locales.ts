import type { VerbatraConfig } from "../config/schema.js";
import { SdkError } from "../errors.js";

/**
 * Resolve which target locales to operate on. With `requested` omitted, all configured target
 * locales are returned. Otherwise the requested subset is returned in config order, and any
 * requested locale that is not among `config.targetLocales` is rejected as a whole-run error
 * (fail loud, no silent narrowing). An explicit empty array keeps its "select none" meaning and
 * is not rejected; the CLI rejects an empty `--locales` list before it reaches here.
 *
 * @param config - The validated config carrying `targetLocales`.
 * @param requested - The requested subset, or `undefined` for all configured targets.
 * @returns The selected locales in config order.
 * @throws {@link SdkError} `UNKNOWN_LOCALE` when any requested locale is not configured; the
 *   message names the unknown locale(s) and the configured targets (locales are not secrets).
 */
export function selectLocales(
  config: VerbatraConfig,
  requested?: readonly string[],
): readonly string[] {
  if (requested === undefined) {
    return config.targetLocales;
  }
  const configured = new Set(config.targetLocales);
  const unknown = requested.filter((locale) => !configured.has(locale));
  if (unknown.length > 0) {
    const label = unknown.length === 1 ? "locale" : "locales";
    throw new SdkError(
      "UNKNOWN_LOCALE",
      `Requested ${label} not in the configured target locales: ${unknown.join(", ")}. ` +
        `Configured targets: ${config.targetLocales.join(", ")}.`,
    );
  }
  const wanted = new Set(requested);
  return config.targetLocales.filter((locale) => wanted.has(locale));
}
