# @verbatra/format-adapters

## 0.1.0

### Minor Changes

- b346b68: Add the first slice of format-adapters: the FormatAdapter interface, an open-for-extension
  adapter registry with defined no-match and ambiguous resolution, and the i18next JSON adapter
  (nested/namespaced keys, CLDR plural-suffix detection, {{double-brace}} placeholder extraction,
  order-preserving round-trip, structured errors on malformed input, prototype-pollution-safe
  parsing). ICU-validity is produced in core's expected shape (empty for i18next).
- 61e217e: Add the next-intl JSON adapter (createNextIntlJsonAdapter), registered in the default registry.
  It parses ICU MessageFormat values to extract argument and rich-text tag placeholders without
  resolving them, sets isPlural from a plural/selectordinal argument, and reports values that fail
  to parse via invalidIcuKeys; the ICU body is kept verbatim on round-trip. ICU parsing uses
  @formatjs/icu-messageformat-parser (the canonical FormatJS parser next-intl builds on) and is
  bounded — a value too deep or malformed is reported as invalid, never thrown. Internally, the
  shared adapter shell was extracted into createJsonFileAdapter and the i18next and vue-i18n
  adapters were reimplemented on it (no behavior change).
- bde1174: Add the ngx-translate JSON adapter (createNgxTranslateJsonAdapter), registered in the default
  registry. It handles both flat ("app.hello": "...") and nested file structures and preserves the
  original style on write (flat stays flat, nested stays nested; a new path defaults to nested),
  rejecting files that mix the two with a structured MIXED_STRUCTURE error. Interpolation is
  {{double-brace}} (reusing the i18next extractor); ngx-translate has no built-in plural or ICU, so
  values are plain strings, isPlural is always false, and invalidIcuKeys is empty. The shared
  createJsonFileAdapter factory gained two optional hooks (validateTree, buildWriteTree); the
  existing adapters are unchanged.
- b346b68: Add the vue-i18n JSON adapter (createVueI18nJsonAdapter), registered in the default registry.
  It handles single-brace {name}/{0} interpolation, recognizes pipe-separated plural values
  ("a | b | {count} c") setting isPlural while keeping the value verbatim, and preserves linked
  messages (@:key) without extracting them. Shared JSON read/write helpers (parse + depth/size
  guards, flatten, unflatten) were factored into an internal json/ module reused by both the
  i18next and vue-i18n adapters; no public API or behavior change to i18next.

### Patch Changes

- 2ab85ca: Make the target-file write atomic: the serialized content is written to a temp file in the same
  directory as the target and then renamed over it, so a crash or interruption mid-write can no
  longer leave a truncated/corrupt target file — a reader sees either the complete prior file or the
  complete new file. Behavior-preserving otherwise: the serialized bytes are byte-identical across
  all four adapters, a write failure still surfaces as the raw fs error (no new error type/code), and
  temp cleanup is best-effort and never masks the original error. Parity with the SDK's lock-file
  atomic write.
- b346b68: Harden the i18next read path against hostile files (Security NO-GO fixes): placeholder
  extraction is now linear (was quadratic on unbalanced `{{`), and read enforces a maximum
  nesting depth and input size, surfacing over-limit or otherwise failing input as a structured
  AdapterError (new codes MAX_DEPTH_EXCEEDED and INPUT_TOO_LARGE) instead of an uncaught
  RangeError. Error messages no longer echo file key paths. No public API signature changes;
  behavior is unchanged for well-formed files.
- b5cd960: Harden JSON and ngx-translate file reads against a stat-then-read TOCTOU by reading through a single fstat'd file handle with a bounded read, so swapping the path for a larger file cannot bypass the size cap. Also wrap ICU validity computation so every read failure surfaces as a structured `AdapterError`.
- Updated dependencies [bde1174]
- Updated dependencies [7aeaca7]
  - @verbatra/core@0.1.0
