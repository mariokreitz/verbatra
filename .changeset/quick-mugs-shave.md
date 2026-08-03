---
"@verbatra/sdk": patch
---

Drop the positional counter from the human progress line, and make
`locale-finished` correlatable.

`renderProgressHuman` printed `[N/total] translating <locale>` on
`locale-started` using the locale's index in the run's target order. The worker
pool claims those indices up front, so at `--concurrency 3` all three lines
printed before any work completed, showing `[1/3]`, `[2/3]` and `[3/3]` and
then continuing past the apparent total. The line is now
`verbatra: translating <locale>`.

No counter replaces it, on either event. A claim ordinal rendered on a finish
would be non-monotonic under concurrency, which is worse than no counter, and a
true completion counter needs run-scoped state that neither the CLI nor the SDK
should grow for a cosmetic line. A locale that has merely started was never
progress, and the `run-finished` line still reports the total.

This adds `localeIndex` and `totalLocales` as required members of the exported
`LocaleFinishedEvent` on `@verbatra/sdk`, so a consumer can pair a finish with
its start without matching on the locale name, which concurrency made necessary.
Both are documented as correlation keys and explicitly not as progress counters.
The behavior fixed is a defect, so the bump stays patch, but the addition to the
public type is called out here as deliberate, following the same house policy
recorded for `BLANK_ROW_BASELINE_RETAINED` in 0.4.4. The SDK is the only
constructor of this event, so no consumer code needs to supply the new fields.

`--json` is unaffected on stdout; the stderr progress records simply carry the
two extra fields.
