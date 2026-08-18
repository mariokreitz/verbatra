---
"@verbatra/sdk": minor
"@verbatra/cli": minor
---

Run `check`, `diff`, and `translate` without a config file

`verbatra check` and `verbatra diff` now work in a project that has no
`verbatra.config.ts` at all, and `verbatra translate` needs only a provider API key
in the environment. When no config file is found, verbatra infers one from the
project: it looks through the directories the i18n ecosystems conventionally use,
works out the path pattern, resolves the format from the file extension or from the
i18n library in `package.json`, treats English as the source locale, and picks a
provider from the API keys that are set.

An authored config still wins outright and nothing about that path changes.
`loadConfig` and `loadConfigWithMeta` keep their exact contract, including
`CONFIG_NOT_FOUND`; detection is reached through the new `resolveProjectConfig`
entry point, which reports what it concluded through the new `ProjectDetection`
shape. The CLI prints that summary before it runs, so a detected project is never a
black box.

Detection declines rather than guesses. A project with two plausible locale
directories, a layout needing more than one path pattern (several namespaces per
locale), an unresolvable format, or no English locale is reported with a specific
code and a remedy instead of a best guess, because a `check` that silently reports
on the wrong files is worse than one that asks for a config.

One related behavior change: every command that loads a config now reads `.env.local`
and `.env` first, where previously only `translate`, `watch`, `doctor`, and `studio`
did. Detection reads provider API keys from the environment, so without this a
`check` run reported no provider key for a project whose key lives in `.env` while
`translate` on that same project worked.

New SDK exports: `resolveProjectConfig`, `requireDetectedProvider`, `detectProject`,
`selectProviderFromEnv`, `formatFromDependencyNames`, `FORMAT_BY_DEPENDENCY`,
`PROVIDER_DETECTION_ORDER`, `CANDIDATE_DIRECTORIES`, and the `DirectoryEntry` type.
`SdkFs` gains an optional `readDirectory`, which detection needs and which existing
implementations may omit. `SdkErrorCode` gains `PROJECT_NOT_DETECTED`,
`PROJECT_AMBIGUOUS`, `PROJECT_LAYOUT_UNSUPPORTED`, and `PROVIDER_KEY_MISSING`.
