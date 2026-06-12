---
"@verbatra/format-adapters": minor
---

Add the ngx-translate JSON adapter (createNgxTranslateJsonAdapter), registered in the default
registry. It handles both flat ("app.hello": "...") and nested file structures and preserves the
original style on write (flat stays flat, nested stays nested; a new path defaults to nested),
rejecting files that mix the two with a structured MIXED_STRUCTURE error. Interpolation is
{{double-brace}} (reusing the i18next extractor); ngx-translate has no built-in plural or ICU, so
values are plain strings, isPlural is always false, and invalidIcuKeys is empty. The shared
createJsonFileAdapter factory gained two optional hooks (validateTree, buildWriteTree); the
existing adapters are unchanged.
