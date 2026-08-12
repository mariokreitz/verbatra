---
"@verbatra/sdk": minor
"@verbatra/cli": minor
---

Classify a provider HTTP 5xx as its own `PROVIDER_UNAVAILABLE` error code instead of the generic
`PROVIDER_ERROR` fallback.

A hard provider outage returns 5xx, which previously matched none of the status or error-class
checks and fell through to `PROVIDER_ERROR`, the code reserved for failures nothing could classify.
An outage and an unrecognized failure are different things, and only the first is worth retrying
later or routing to another provider, so they now carry different codes.

The new code is deliberately separate rather than folded into `TIMEOUT` or `RATE_LIMITED`: both of
those name a specific, different failure, and reporting an outage as "the request timed out" or
"you were rate-limited" would be untrue in the text a user reads. A sub-batch withheld during an
outage now names `PROVIDER_UNAVAILABLE` in its notice.

Classification of every other failure is unchanged. In particular 401 and 403 still classify as
`AUTH_FAILED`, which remains permanent and not worth retrying.
