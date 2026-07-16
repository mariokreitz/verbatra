---
"@verbatra/sdk": patch
---

Fix generated plural forms trusting the provider's self-reported `result.integrity` map instead of
recomputing the accept/withhold decision through the shared integrity gate. Every other disk-writing
path (the main translation run, workbook import, and manual retranslate or edit) already recomputes
placeholder and ICU integrity directly from the candidate value rather than trusting what the provider
claims about its own output; generated plural forms are now the same. Practical impact today is small,
since plural-form generation only ever runs for the non-ICU i18next-json format, but a provider that
misreports its own placeholder match can no longer slip a mismatched generated form past the check.

`@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump; its own behavior is
unchanged.
