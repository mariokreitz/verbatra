---
"@verbatra/sdk": patch
---

Report a locale honestly when its keys are withheld, and retry truncated batches. A run that withheld every key for a locale previously reported it as succeeded and exited 0, so a run that produced nothing looked like a clean success in CI. Such a locale is now reported as failed and the command exits non-zero. A locale that translated some keys but withheld others is reported as partial and still exits 0, because withheld keys keep their prior state and are retried next run. The run summary gains a partial list alongside succeeded and failed. This exit-code change applies to both translate and import.

On an OUTPUT_TRUNCATED provider error (common with reasoning models whose reasoning tokens consume the output budget), the failing sub-batch is now automatically re-split toward a single entry and retried before any key is withheld.
