# Deferred hardening advisories

Non-blocking security advisories accepted for now, to be addressed in a later defense-in-depth
pass. Each was raised during a Security review and consciously deferred (not a regression, not
exploitable in normal operation).

## Open

- Stat-then-read TOCTOU on adapter file reads. Between the `stat` size check and the `readFile`,
  the file can change, so an attacker who swaps a small file for a large one in that window
  bypasses the `MAX_INPUT_BYTES` cap. Affects `packages/format-adapters/src/json/json-file-adapter.ts`
  (`read`, stat at line 86 / readFile at line 93) and
  `packages/format-adapters/src/ngx-translate/structure.ts` (`detectStyle`, stat at line 44 /
  readFile at line 48). Fix idea: open a file handle once, `fstat` it, and read a bounded number of
  bytes from the same handle.
- `computeInvalidIcuKeys` runs outside the read structured-error wrap. In
  `packages/format-adapters/src/json/json-file-adapter.ts` (`read`, line 97) the
  `computeInvalidIcuKeys` callback is invoked outside the `toEntries` try/catch. It is safe today
  because the next-intl ICU analyzer is total (never throws), but a future non-total analyzer could
  let a non-`AdapterError` escape `read`. Fix idea: wrap the `computeInvalidIcuKeys` call so any
  throw becomes a structured `AdapterError`, or document and enforce the totality invariant.
