---
"@verbatra/sdk": minor
"@verbatra/cli": minor
---

Read this before upgrading: `verbatra translate` and `verbatra import` now exit `1` when a
locale comes out partial. A pipeline that passes today can start failing after this upgrade,
and that is the point of the change. A partial locale is one whose file was written to disk
with some keys still missing, so a run that reports `0 succeeded, 1 partial, 0 failed` used to
exit `0` and let a half-translated file through a CI gate. If your pipeline starts failing here,
it was already shipping incomplete translations. Re-run the affected locale (now possible with
`--locales`), or if you genuinely want to accept a partial result, branch on the `partial` field
of the `--json` summary yourself rather than on the exit code.

The exit code is `1`, not a new code: `1` already means the command ran but the result is not
clean, which is exactly this case. The asymmetry that hid the bug is gone too. Re-running the
same broken state used to exit `1`, because the failing key was then the only candidate and
nothing was accepted, so the worse a run went, the more likely it was to exit `0`.

Three further changes come with it:

- `translate` and `watch` accept `--locales de,fr` (SDK: `locales`), matching `check`, `diff`,
  and `export`. Translating one locale at a time is what a rate-limited free tier needs, and it
  is the quickest way to re-run a single locale that came out partial. An unconfigured locale
  fails with `UNKNOWN_LOCALE` before anything is read or spent, and `watch` validates the subset
  once at startup rather than on every run.
- An unwritable target locale file now fails with a structured `TARGET_UNWRITABLE` naming the
  real target and the file-system code, instead of a raw `EACCES` quoting the internal temporary
  file that the atomic write had already deleted. `TARGET_UNWRITABLE` is a new `SdkErrorCode`:
  `translate` and `importWorkbook` record it on the affected locale, `editEntry` and
  `retranslateEntry` throw it.
- A `PROVIDER_ERROR` from an unreachable endpoint now names the transport cause (connection
  refused, host name not resolved, connection closed, host unreachable, untrusted TLS
  certificate) and what to check. For `openai-compatible` it also names the host and port of the
  configured `baseUrl`. Only the URL's host component is used, so a path, query, or embedded
  credential in `baseUrl` can never reach a message. The error codes themselves are unchanged.
