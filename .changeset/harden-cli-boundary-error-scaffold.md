---
"@verbatra/cli": minor
---

Harden the CLI's error handling at four boundary points that previously bypassed the structured error
scaffold and could surface a raw stack instead of a clean exit code:

- `translate` and `watch` now load `.env`/`.env.local` inside the same try that maps errors to exit
  `2`. A missing `.env` file is still a silent no-op, but a non-ENOENT read error (for example an
  unreadable file, or a directory named `.env`) now renders as a structured error instead of an
  unhandled exception.
- `--debounce` is now validated instead of silently defaulted. A non-integer, zero, negative, or
  unit-suffixed value (like `250ms`) is rejected as a usage error (`INVALID_DEBOUNCE`, exit `2`); it no
  longer falls back to the 300ms default. This is a user-facing behavior change: a `--debounce` value
  that previously silently defaulted now fails the run.
- All six one-shot commands (`translate`, `watch`, `export`, `import`, `check`, `diff`) now validate
  their options with a zod schema inside the error scaffold. `import`'s option parsing in particular
  moved inside the try, so a malformed option object can no longer escape as an unhandled rejection.
- The exit-code documentation in the package header and `run()`'s JSDoc now also names `check`/`diff`
  returning `1` for drift or pending changes, alongside `translate`/`import`'s "some locales failed".

`@verbatra/sdk` is version-locked with `@verbatra/cli` and picks up the same bump with no behavior
change of its own.
