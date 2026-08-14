---
"@verbatra/sdk": minor
"@verbatra/cli": minor
---

New `verbatra doctor` command and its `doctor()` SDK entry point: a preflight that answers "is this
project set up correctly?" and spends nothing. It constructs no provider, makes no network request,
writes no file, and never reads an API key value.

Five checks run, each reporting its own verdict: the config loads and validates, the configured
format resolves to a file adapter, the configured provider ID resolves to a provider factory, the
environment variable that provider reads its key from is set, and the source locale file exists.
Every check runs even when an earlier one failed, so one run reports every independent problem
rather than stopping at the first. When the config itself cannot be loaded, the four checks that
need it report `skipped` instead of a verdict they could not reach.

This is the validation that was missing for a fresh project. `verbatra check` was the cheapest one
available, but it reads the locale files and dies with `SOURCE_UNREADABLE` before it can tell you
anything, so it could never validate a project whose source file is not in place yet.

Details worth knowing:

- The API key is checked by name only. `doctor` asks whether the variable is set, never what it
  holds, so no key value is read, printed, or validated against a provider. The
  `openai-compatible` provider is the one exception to a missing variable being a failure: it
  falls back to a placeholder key, so an unset variable passes unless the config names its own
  through `provider.options.apiKeyEnvVar`.
- A missing target locale file is not a problem, since `translate` creates it. A missing source
  locale file is, because every other entry point fails on it.
- The command takes the shared `--cwd` and `--config` flags plus `--json`, which prints the report
  in the usual envelope. It exits `0` when every check passed and `1` when any check failed, the
  same "it ran, the result is not clean" meaning `check` and `diff` already carry. Exit `2` stays
  reserved for `doctor` being unable to run at all, such as a `--config` path that does not exist.
- Like `translate`, the command loads `.env.local` and then `.env` before it looks at the
  environment, so a key kept in a dotenv file counts as set.
