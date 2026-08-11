---
"@verbatra/sdk": patch
"@verbatra/cli": patch
---

Stop a narrower delimited re-export from leaving locale files a later import reads as fresh.

A `csv` or `tsv` export writes one file per locale into a directory, so re-exporting into a directory
that still holds output from an earlier run with a wider `--locales` selection left the dropped
locales' files behind, indistinguishable from the ones just written. The next import read them and
applied outdated translations silently.

A delimited export now records the locales it wrote in a hidden per-format manifest in the output
directory (`.verbatra-export-csv.json` or `.verbatra-export-tsv.json`), written after the locale
files. Import reconciles a handoff directory against it: a locale file the most recent export did not
write is refused as a leftover and reported as that locale's failure (`HANDOFF_FILE_STALE`) instead
of being applied. A directory with no readable manifest (assembled by hand, or round-tripped through
an archive that dropped the hidden file) is read exactly as before, and naming a single interchange
file directly is still taken at face value.

The export deletes nothing. Nothing in the output directory is removed or overwritten except the
per-locale files this export writes and its own manifest, so an unrelated file placed there is never
at risk.
