---
"@verbatra/sdk": patch
---

Fix plural-form generation ignoring maxBatchSize and one failure discarding a whole locale run. Stale plural-generation items are now split into sequential sub-batches no larger than maxBatchSize, matching main translation batching. A sub-batch whose provider call throws now withholds only its own forms instead of aborting the locale run, so already-accepted main translations and other successful plural sub-batches are written as before.
