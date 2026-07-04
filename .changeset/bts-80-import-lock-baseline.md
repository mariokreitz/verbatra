---
"@verbatra/sdk": patch
---

Fix `importWorkbook` advancing a locale's lock baseline for a changed key whose workbook cell was left blank, which permanently hid drift from `check` and `diff`.

Previously, a changed source key with an empty translation cell fell through the row classification unresolved (neither accepted nor withheld), and the lock baseline was still advanced to the current source hash. The target file kept the translation of the old source, but `check` and `diff` reported the locale as in sync forever.

Now only keys actually accepted this run advance their lock baseline. Every other source-present key, including a row left blank on a changed key, keeps its prior baseline hash so drift keeps being reported until the row is filled or the source reverts. This applies uniformly to a single blank row and to an entirely blank workbook across every locale. A locale summary that retains a baseline this way now carries a `BLANK_ROW_BASELINE_RETAINED` notice.
