---
"@verbatra/cli": minor
---

Wrap every `--json` record on stdout in one discriminated envelope, and emit one for a failed run.

Before this change a caller driving the CLI with `--json` could parse a success but not a failure:
a whole-run error left stdout empty, so the only machine-usable signal was the exit code and the
only way to learn why was to scrape the human-readable stderr line. The success payloads had the
matching gap in the other direction: they were a bare summary object with no marker of which command
produced them or which shape version they followed.

Every `--json` record on stdout is now one line of one shape:

- success: `{ "ok": true, "version": 1, "command": "check", "result": { ...the previous payload } }`
- failure: `{ "ok": false, "version": 1, "command": "check", "code": "CONFIG_INVALID", "message": "..." }`

Three contract decisions worth stating, since consumers depend on them:

- `version` is the version of the envelope shape, not the package version, and it is an integer so
  a consumer compares it with `===` and is never tempted to range-parse it. Adding a field does not
  bump it, so ignore fields you do not recognize.
- The command payload is nested under `result` rather than spread next to `ok`, so an envelope field
  can never collide with a payload field and the payload stays versionable on its own.
- `watch --json` keeps one NDJSON record per run and now uses the same envelope for each, with
  `ok` carrying what the old `status` field carried. A failed run does not terminate the stream.

A failing run writes exactly one envelope line to stdout and still exits `2`. Exit codes are
unchanged in every case. The human-readable stderr line is unchanged in both modes, byte for byte,
so consumers that read the exit code and stderr are unaffected. The envelope carries the same
secret-free `{ code, message }` projection the stderr line renders, so it can disclose nothing the
stderr line would not have. Progress and lock-wait records stay on stderr.

This is a breaking change for anything parsing `--json` stdout: read `result` instead of the bare
object, and branch on `ok`. The bundled GitHub action already understands both shapes, so a pinned
older `verbatra-version` keeps working.
