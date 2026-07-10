import { z } from "zod";
import { PROVIDER_ENV } from "../env.js";

const HOSTED_PROVIDER_ENV_VARS: ReadonlySet<string> = new Set(
  Object.values(PROVIDER_ENV).map((name) => name.toUpperCase()),
);

/**
 * True unless `value` names one of the four hosted providers' environment variables. Compares
 * uppercased: `process.env` lookups are case-insensitive on Windows, so a lowercase or mixed-case alias
 * like "openai_api_key" must be rejected exactly like "OPENAI_API_KEY", or it would resolve to the same
 * hosted key on that platform and reach a custom baseUrl.
 */
function isNotHostedProviderEnvVar(value: string): boolean {
  return !HOSTED_PROVIDER_ENV_VARS.has(value.toUpperCase());
}

function isHttpOrHttpsUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Provider-specific configuration for the openai-compatible provider: a local or self-hosted
 * OpenAI-compatible inference server (LM Studio, Ollama, vLLM). Unlike every hosted provider, `baseUrl`
 * belongs in config: it is a network address the user already knows (typically a LAN IP or localhost),
 * not a secret. `apiKeyEnvVar` never carries a key value, only the name of the environment variable to
 * read one from; see `resolveOpenAiCompatibleKey` in `env.ts` for the full three-tier resolution.
 *
 * A malformed or non-http(s) `baseUrl`, or an `apiKeyEnvVar` naming a hosted provider's variable, fails
 * here with a `ZodError` at config-parse time, the same way every other provider validates its config.
 *
 * v1 allows plaintext `http:` to any host, including non-loopback, with no scheme-based restriction
 * beyond http/https. This is a deliberate v1 decision (see the openai-compatible provider docs): when a
 * real key is configured (`apiKeyEnvVar` or `OPENAI_COMPATIBLE_API_KEY` resolves to a non-empty value)
 * and `baseUrl` is plaintext `http:` to a non-loopback host, that key travels over the network in
 * cleartext. Not enforced or warned about at runtime here; documented as a residual risk instead.
 */
export const openAiCompatibleConfigSchema = z.object({
  baseUrl: z
    .url({ message: "baseUrl must be a valid absolute URL." })
    .refine(isHttpOrHttpsUrl, { message: "baseUrl must use the http or https scheme." }),
  model: z.string().min(1),
  maxOutputTokens: z.number().int().positive(),
  apiKeyEnvVar: z
    .string()
    .min(1)
    .refine(isNotHostedProviderEnvVar, {
      message: "apiKeyEnvVar must not name a hosted provider's environment variable.",
    })
    .optional(),
});

export type OpenAiCompatibleConfig = z.infer<typeof openAiCompatibleConfigSchema>;
