---
"@verbatra/sdk": patch
---

Fix ICU plural/select placeholder-integrity checking (next-intl and ARB) to compare source and target
branch by matched branch instead of flattening each side into one multiset first. The prior flattening
strategy dropped any placeholder confined to only some branches of a value before the comparison ever ran,
which meant a fabricated placeholder invented in a single branch of a translated ARB or next-intl value
(for example, only in a richer target locale's `few` or `many` CLDR category) could pass the integrity
check undetected. The new comparison walks matched plural/select nodes branch by branch: a category present
on both sides is checked directly, so an invention or a drop confined to one branch is caught precisely; a
category only the target's richer cardinality supplies is checked for fabricated content against the union
of every source branch, so a translator legitimately reusing a placeholder that appears in only one source
branch is never wrongly rejected. This closes the gap for the LLM and DeepL provider translation paths and
for workbook import, the two live call sites that resolve an ICU-capable format adapter.

`@verbatra/cli` is version-locked with `@verbatra/sdk` and picks up the same bump; its own behavior is
unchanged.
