---
"@verbatra/ai-providers": patch
"@verbatra/sdk": patch
---

Refresh the bundled Anthropic (`@anthropic-ai/sdk`, 0.105.0 to 0.111.0), Gemini (`@google/genai`,
2.9.0 to 2.11.0), and OpenAI (`openai`, 6.44.0 to 6.47.0) SDKs pinned in the `bundled` pnpm catalog.
`@verbatra/sdk` bundles `@verbatra/ai-providers` into its published dist, so these exact versions
ship to every consumer of `@verbatra/sdk` and `@verbatra/cli`.

Each vendor's changelog was reviewed across the bumped range for changes on every surface this
package touches: request construction, response parsing, and error classification. None of the
three renamed or removed a field, response shape, or SDK error class verbatra reads (`RateLimitError`,
`AuthenticationError`, `PermissionDeniedError`, `APIConnectionTimeoutError`, and `APIUserAbortError`
for the two SDKs that classify by class identity; HTTP status codes for Gemini). Gemini 2.11.0's one
refactor in range, removing `cached_content`, `presence_penalty`, and `frequency_penalty` from
request options, is scoped to the newer Interactions API; the classic `models.generateContent` call
this provider uses is unaffected, per the SDK's own release notes. New model IDs each vendor added in
this range (for example claude-sonnet-5, gpt-5.6-sol) are now available to configure, since verbatra
never restates a model allow-list of its own; it forwards whatever model id a project's config sets.

No behavior change beyond what each vendor's own patch and minor releases carry. `@verbatra/cli` is
version-locked with `@verbatra/sdk` and picks up the same bump; its own behavior is unchanged.
