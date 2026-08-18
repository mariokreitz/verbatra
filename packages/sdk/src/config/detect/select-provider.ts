import { PROVIDER_ENV, SCAFFOLD_MODELS, SCAFFOLD_TOKEN_LIMIT_KEYS } from "@verbatra/ai-providers";
import type { ScaffoldableProviderId } from "../../scaffolding.js";
import type { ProviderConfig } from "../provider-config.js";

/**
 * The order in which a detected provider is chosen when several API keys are present in the
 * environment. It is fixed and documented rather than dependent on environment ordering, so the same
 * project resolves to the same provider on every machine and in every CI run.
 *
 * `openai-compatible` is deliberately absent: it needs a `baseUrl` and a model name that only the
 * user can supply, which is the same reason {@link ScaffoldableProviderId} excludes it.
 */
export const PROVIDER_DETECTION_ORDER: readonly ScaffoldableProviderId[] = [
  "anthropic",
  "openai",
  "gemini",
  "deepl",
];

/** The default output token limit written into a detected provider block. */
export const DETECTED_TOKEN_LIMIT = 4096;

/** Which provider the environment selected, and which other keys were also present. */
export interface ProviderSelection {
  /** The provider to use. */
  readonly id: ScaffoldableProviderId;
  /**
   * False when no API key was found at all and {@link id} is only a placeholder, kept so the
   * synthesized config still satisfies the schema. Read-only commands ignore this; a command that
   * would call the provider must refuse when it is false.
   */
  readonly resolved: boolean;
  /** Providers whose keys were also set but lost to {@link PROVIDER_DETECTION_ORDER}. */
  readonly alsoAvailable: readonly ScaffoldableProviderId[];
}

function hasKey(env: NodeJS.ProcessEnv, id: ScaffoldableProviderId): boolean {
  const value = env[PROVIDER_ENV[id]];
  return value !== undefined && value.length > 0;
}

/**
 * Chooses a translation provider from the API keys present in the environment.
 *
 * Never throws and always names a provider, so one code path serves every command: the read-only
 * commands ignore {@link ProviderSelection.resolved} because they never call a provider, and the
 * commands that do call one refuse when it is false. No key value is read, compared, or retained
 * here beyond testing whether the variable is non-empty.
 *
 * @param env - The environment to inspect, normally `process.env`.
 * @returns The chosen provider, whether a real key backed it, and any runners-up.
 */
export function selectProviderFromEnv(env: NodeJS.ProcessEnv): ProviderSelection {
  const available = PROVIDER_DETECTION_ORDER.filter((id) => hasKey(env, id));
  const [chosen, ...alsoAvailable] = available;
  if (chosen === undefined) {
    return { id: "anthropic", resolved: false, alsoAvailable: [] };
  }
  return { id: chosen, resolved: true, alsoAvailable };
}

/**
 * Builds the `provider` block of a synthesized config for a detected provider.
 *
 * The model and the output-token option key both come from the SDK's scaffolding tables rather than
 * from literals here, because each provider validates its options strictly and they do not agree on
 * the key name: Anthropic takes `maxTokens` and the others `maxOutputTokens`.
 *
 * The result is deliberately typed as a plain object rather than as {@link ProviderConfig}: the
 * option key is computed, and the whole synthesized config is validated against
 * {@link verbatraConfigSchema} before it is used, so this stays on the unvalidated side of that
 * boundary.
 *
 * @param id - The provider the environment selected.
 * @returns An unvalidated provider block for the schema to check.
 */
export function buildDetectedProviderConfig(id: ScaffoldableProviderId): {
  readonly id: ScaffoldableProviderId;
  readonly options: Readonly<Record<string, unknown>>;
} {
  if (id === "deepl") {
    return { id, options: {} };
  }
  return {
    id,
    options: {
      model: SCAFFOLD_MODELS[id],
      [SCAFFOLD_TOKEN_LIMIT_KEYS[id]]: DETECTED_TOKEN_LIMIT,
    },
  };
}
