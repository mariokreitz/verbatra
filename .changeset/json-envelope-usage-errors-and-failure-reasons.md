---
"@verbatra/cli": patch
---

Report the reason a run failed, in both output modes.

Three gaps closed, all of them cases where the CLI knew why something failed and did not say so:

- A usage error under `--json` (an unknown option, a missing required argument, an unknown command)
  exited `2` with an empty stdout, so a consumer piping stdout to a parser got nothing to parse. It
  now writes the documented single `ok: false` envelope, with code `USAGE_ERROR` and `command: null`
  when the failure happened before a command was resolved.
- `watch --json` wrote no envelope when the watcher failed to start or failed to stop, while the
  identical error under `translate --json` did. Both now emit one error envelope on the NDJSON
  stream, the same shape a failed run already used.
- A locale that failed because its provider calls failed carries no `error` object (it reports
  through `providerFailures` and its notices), so the human output rendered a bare `de: failed` with
  no code, no message, and no cause. Locale lines now list the provider-failed keys and each
  notice's code and message, so a withheld sub-batch names its cause (for example `RATE_LIMITED` or
  `PROVIDER_UNAVAILABLE`) and says it will be retried. `provider-failed` is also counted on the
  locale line alongside the other withholding counts.

No change to any exit code, and nothing new on stdout without `--json`. Output gains lines only
where a withheld key or a notice previously had no detail: a locale carrying provider failures or
notices now also lists them, so a partial locale that used to show only a `notices` count now shows
each notice too.
