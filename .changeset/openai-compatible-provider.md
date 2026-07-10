---
"@verbatra/sdk": minor
---

Add a new provider id `openai-compatible` for pointing verbatra at a local or self-hosted OpenAI-compatible inference server (LM Studio, Ollama, vLLM). Configure it with `{ baseUrl, model, maxOutputTokens, apiKeyEnvVar? }`; `baseUrl` is validated as an absolute http or https URL at config-parse time, and lives in config rather than the environment since it is a network address, not a secret. It must include your server's API path segment (typically `/v1`, the same convention the underlying client already uses for the hosted `openai` provider).

The API key still never lives in config. It resolves in three tiers: an explicitly named `apiKeyEnvVar` (throws a clear error if that variable is unset), then the new convention variable `OPENAI_COMPATIBLE_API_KEY`, then the non-secret placeholder `"local"` for servers that need no key at all. `apiKeyEnvVar` cannot name any of the four hosted providers' environment variables, and the new provider's client never reads `OPENAI_API_KEY` or shares any code path with the hosted `openai` provider, so a hosted key can never reach a custom `baseUrl`.

The request body uses the same strict, schema-constrained response format as the hosted `openai` provider (verified against a live LM Studio server); the one difference is that this provider tolerantly strips a single leading and trailing Markdown code fence from the response before parsing, since a local or smaller model can still wrap an otherwise-correct answer in a ```json block despite the constraint. Its output still runs through the exact same canonical schema validation and placeholder and ICU integrity checks as every other provider.

`@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump; its own behavior is unchanged, and `verbatra init` does not yet offer `openai-compatible` as a scaffold option (it has no single required environment variable, unlike every other provider).
