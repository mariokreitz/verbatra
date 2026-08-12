---
"@verbatra/sdk": minor
"@verbatra/cli": minor
---

Add locale directory layout styles and the locale path resolver.

`files` gains an optional `localeStyle` of `"literal"`, `"posix"`, or `"android"`. It controls what
the `{locale}` token in `files.pattern` expands to for each locale:

- `"literal"` is the default and what a config without the field gets: the configured tag verbatim.
  Every existing project resolves to exactly the paths it did before, byte for byte.
- `"posix"` replaces `-` with `_`, for gettext directories (`locale/pt_BR/LC_MESSAGES/messages.po`)
  and the Java `messages_{locale}.properties` suffix layout.
- `"android"` expands the token to a complete Android resource-directory segment, `values` prefix
  included: `values` for the source locale, `values-de`, `values-pt-rBR`, `values-fil-rPH`, and the
  modified BCP-47 form `values-b+zh+Hans`, `values-b+es+419`, `values-b+sr+Latn+RS` where the legacy
  qualifier cannot express the tag. The pattern is `res/{locale}/strings.xml`, and the token must
  occupy a whole path segment under this style.

The new `createLocalePathResolver(cwd, config)` is exported from the package root. It resolves a
locale to its absolute file path (`pathFor`) and a path back to the locale that owns it
(`localeFor`, `undefined` for a path the project does not own). Every SDK flow now resolves paths
through it, so a consumer that watches or reports on locale files uses the same mapping rather than
re-deriving it.

`SdkErrorCode` gains two members, both raised when the resolver is created and so before any file is
read and before any provider call:

- `LOCALE_LAYOUT_INVALID`: the pattern and style cannot be combined, or the style has no valid
  spelling for a configured locale (`zh-Hans` under `"posix"`, for instance), or a locale expands to
  something that is not a single path segment. A style refuses rather than guesses, because a wrong
  directory name is written successfully and then silently ignored at runtime.
- `LOCALE_PATH_COLLISION`: two configured locales resolve to the same absolute path.
