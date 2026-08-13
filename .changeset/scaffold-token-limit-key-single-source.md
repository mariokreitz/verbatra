---
"@verbatra/sdk": minor
"@verbatra/cli": minor
---

Stop `verbatra init` from being able to write a config it just called valid.

The command encoded which token-limit option each provider takes in two independent places:
Anthropic calls it `maxTokens`, OpenAI and Gemini call it `maxOutputTokens`. One copy built the
object checked against the config schema; the other produced the `verbatra.config.ts` text that was
actually written to disk, and that copy was never validated. Any drift between them, an option
renamed or a provider added, would have produced an `init` that reported success and left behind a
config that failed to load on the very next command.

`scaffoldingMetadata` now carries `providerTokenLimitKeys`, so the key is stated once, in the SDK,
tied by a type constraint to the option each provider's own schema accepts. The CLI renders the
provider block by serializing the exact options object the schema validated, rather than
re-describing it, so the written text and the checked value cannot disagree.

No change to the configs `init` produces for the providers shipped today.
