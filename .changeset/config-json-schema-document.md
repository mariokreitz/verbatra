---
"@verbatra/sdk": minor
"@verbatra/cli": minor
---

`@verbatra/sdk` now ships the config schema as a JSON Schema document at
`@verbatra/sdk/config-schema.json` (`dist/config-schema.json`), generated at build time from the
same zod schema the SDK validates with. Point an editor at it, through an in-file `$schema` key or
an explicit editor mapping, and a `.verbatrarc.json`, `.verbatrarc`, or YAML config gets key
completion and validation while you type. See the config-file page for both wiring paths and for
the three runtime rules the document cannot express.

The config object now accepts an optional top-level `$schema` key, so an editor pointer no longer
trips the strict-object check. It is ignored at runtime and is the only extra key tolerated.

One behavioral detail for anyone branching on a validation issue's `code`: the `files.pattern` must
contain the `{locale}` token rule moved from a whole-config refinement to a field-level regex, so
its issue `code` changed from `custom` to `invalid_format`. The message and the `["files",
"pattern"]` path are unchanged, and an empty `files.pattern` now reports two issues (minimum length
and the token rule) where it previously reported one. The same move applies to the
openai-compatible provider's `baseUrl` scheme guard, whose `code` changed from `custom` to
`invalid_format` with its message unchanged.
