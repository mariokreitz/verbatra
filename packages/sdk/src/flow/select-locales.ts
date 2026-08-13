import type { VerbatraConfig } from "../config/schema.js";
import { SdkError } from "../errors.js";

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
