---
"@verbatra/sdk": patch
"@verbatra/cli": patch
---

Fix `translate` and `importWorkbook` deleting the lock-file baseline of a target key that has no
source entry. Both paths write the locale's lock entries in replace mode and rebuilt them only from
keys the source still has, so a key that lives in the target alone lost its recorded hash on every
run. Generated CLDR plural forms are exactly that shape: `items_few` and `items_many` exist in a
Polish target while the English source only has `items_one` and `items_other`. `translate` used to
protect them, but only while `generatePlurals` was on; an import, or a run with the flag off, wiped
them. Once the hash was gone the form counted as adopted rather than generated, so it was never
reconsidered again even after its governing source string changed.

Both paths now carry a source-less key's prior hash forward. The rule is keyed on the merged target
content, so a key genuinely deleted from the target file still loses its entry, and a key that never
had a hash (an existing plural form verbatra adopted rather than generated) still gets none.

Consumer impact: lock files will keep entries that earlier versions dropped, so the next
`translate`, `import`, or `export` after upgrading can produce a larger `verbatra.lock.json` diff
than usual. That diff is the repair. Hashes that earlier versions already deleted are not
reconstructed: for a generated plural form whose baseline was lost, the form is now treated as
hand-written and adopted, and re-running with `generatePlurals` on will not regenerate it. Delete
that form from the target file to have it generated again.
