/**
 * Reads one `watch --json` record and answers a single question: did the run deliver the key the
 * test is waiting for, was it withheld because the provider throttled us, or did something actually
 * break?
 *
 * This exists because a live provider run has two failure modes that look identical from the file
 * system. A key that never appears because the CLI is broken and a key that never appears because
 * the provider returned 429 both present as "the file did not change". Polling the file cannot tell
 * them apart, so a test that polls must either fail on both (making a release hostage to a free-tier
 * rate limit) or tolerate both (making the test unable to fail). The CLI already reports the
 * difference as structured data, so the test reads that instead of guessing.
 *
 * Nothing here imports `@verbatra/sdk`: this suite drives the published tarball, so the payload is
 * described structurally, exactly as a third-party consumer parsing the documented `--json`
 * contract would have to describe it.
 */

import type { JsonEnvelope } from "./harness.js";

/** One notice on a locale summary: a stable code and a static, secret-free message. */
export interface WatchNotice {
  readonly code: string;
  readonly message: string;
}

/**
 * The fields of one locale's run summary this suite reads. Every field is optional because this is
 * JSON parsed from a separately-published package rather than a compile-time type: a field the
 * installed tarball does not write must read as absent, not crash the classifier.
 */
export interface WatchLocaleSummary {
  readonly locale: string;
  /** The locale's honest run status: nothing withheld, some withheld, or nothing accepted at all. */
  readonly status?: "succeeded" | "partial" | "failed";
  /** Keys translated and written this run. */
  readonly translated?: readonly string[];
  /** Keys already up to date, left unchanged this run. */
  readonly unchanged?: readonly string[];
  /** Keys served from the translation-memory cache instead of the provider. */
  readonly cacheHits?: readonly string[];
  /** Plural-category keys the run synthesized. */
  readonly generated?: readonly string[];
  /** Keys withheld because nothing came back for them (the provider call failed, or the key was missing from the response). */
  readonly providerFailures?: readonly string[];
  /** Keys withheld because the returned translation failed the placeholder-integrity gate. */
  readonly integrityMismatches?: readonly string[];
  /** Keys never sent because a configured token budget already tripped. */
  readonly budgetWithheld?: readonly string[];
  /** Provider and SDK notices for this locale, including the withheld-sub-batch notice. */
  readonly notices?: readonly WatchNotice[];
  /** Present only when the locale itself threw, as a secret-free projection. */
  readonly error?: WatchNotice;
}

/** The `result` payload of one `watch --json` success record: the run summary. */
export interface WatchRunSummary {
  readonly locales?: readonly WatchLocaleSummary[];
}

/** Which key, in which locale, a live watch test is currently waiting on. */
export interface WatchTarget {
  readonly locale: string;
  readonly key: string;
}

/**
 * What one watch run said about the awaited key.
 *
 * - `delivered`: the run accepted the key, so the flow under test made progress.
 * - `throttled`: the provider rate-limited the request and the SDK withheld the key for the next
 *   run. Environmental, not a product fault, and the documented retry path applies.
 * - `failed`: anything else went wrong. Always a test failure.
 * - `pending`: this record says nothing about the key yet (a run that started before the source
 *   change landed, for instance). Keep reading.
 */
export type KeyOutcome =
  | { readonly kind: "delivered" }
  | { readonly kind: "throttled"; readonly detail: string }
  | { readonly kind: "failed"; readonly detail: string }
  | { readonly kind: "pending" };

/** A {@link KeyOutcome} that actually answers the question, once `pending` records are read past. */
export type SettledKeyOutcome = Exclude<KeyOutcome, { readonly kind: "pending" }>;

/**
 * The exact shape the SDK formats a withheld sub-batch's cause with: `(CODE: message)`. Anchored on
 * the parenthesised code rather than a bare substring so the word appearing anywhere else in a
 * message can never be read as a throttle.
 *
 * If that format ever changes, this stops matching and a genuinely throttled run is reported as a
 * failure. That is the safe direction on purpose: the test goes red and the contract gets re-read,
 * rather than a real fault being silently absorbed as an environment skip.
 */
const RATE_LIMITED_NOTICE_PATTERN = /\(RATE_LIMITED:/;

/** The notice code the SDK raises for a sub-batch whose provider call failed. */
const WITHHELD_SUB_BATCH_CODE = "SUB_BATCH_FAILED";

/** The provider error code for a rate-limited call, as it appears on a locale-level failure. */
const RATE_LIMITED_CODE = "RATE_LIMITED";

/** Every list a key lands in when the run accepted it, whatever route it took to get there. */
function acceptedKeys(summary: WatchLocaleSummary): readonly string[] {
  return [
    ...(summary.translated ?? []),
    ...(summary.unchanged ?? []),
    ...(summary.cacheHits ?? []),
    ...(summary.generated ?? []),
  ];
}

/** Renders a locale's notices into one reportable line. */
function describeNotices(summary: WatchLocaleSummary): string {
  return (summary.notices ?? []).map((notice) => `${notice.code}: ${notice.message}`).join("; ");
}

/**
 * Decides why a key landed in `providerFailures`. Only a withheld-sub-batch notice naming
 * `RATE_LIMITED` counts as throttling; every other cause (an auth failure, a timeout, a key the
 * provider simply never returned) is a real failure.
 */
function classifyWithheldKey(summary: WatchLocaleSummary, key: string): KeyOutcome {
  const throttled = (summary.notices ?? []).find(
    (notice) =>
      notice.code === WITHHELD_SUB_BATCH_CODE && RATE_LIMITED_NOTICE_PATTERN.test(notice.message),
  );
  if (throttled !== undefined) {
    return { kind: "throttled", detail: throttled.message };
  }
  const notices = describeNotices(summary);
  const cause = notices.length > 0 ? ` (${notices})` : " with no notice explaining why";
  return { kind: "failed", detail: `"${key}" was withheld${cause}` };
}

/** Classifies a locale that threw outright, which throttling can also cause. */
function classifyLocaleError(summary: WatchLocaleSummary, error: WatchNotice): KeyOutcome {
  if (error.code === RATE_LIMITED_CODE) {
    return { kind: "throttled", detail: `locale "${summary.locale}" was rate-limited` };
  }
  return {
    kind: "failed",
    detail: `locale "${summary.locale}" failed (${error.code}: ${error.message})`,
  };
}

/** Answers the outcome question for one locale's summary. */
function classifyLocaleSummary(summary: WatchLocaleSummary, key: string): KeyOutcome {
  const error = summary.error;
  if (error !== undefined) {
    return classifyLocaleError(summary, error);
  }
  if (acceptedKeys(summary).includes(key)) {
    return { kind: "delivered" };
  }
  if ((summary.providerFailures ?? []).includes(key)) {
    return classifyWithheldKey(summary, key);
  }
  if ((summary.integrityMismatches ?? []).includes(key)) {
    return { kind: "failed", detail: `"${key}" failed the placeholder-integrity gate` };
  }
  if ((summary.budgetWithheld ?? []).includes(key)) {
    return { kind: "failed", detail: `"${key}" was withheld by the token budget` };
  }
  return { kind: "pending" };
}

/**
 * Classifies one `watch --json` record against the key a test is waiting for.
 *
 * @param envelope - One parsed NDJSON record from the watch stream.
 * @param target - The locale and key being awaited.
 * @returns What this record says about that key; see {@link KeyOutcome}.
 */
export function classifyWatchEnvelope(
  envelope: JsonEnvelope<WatchRunSummary>,
  target: WatchTarget,
): KeyOutcome {
  if (!envelope.ok) {
    return {
      kind: "failed",
      detail: `the run failed (${envelope.code}: ${envelope.message})`,
    };
  }
  const summary = (envelope.result.locales ?? []).find((locale) => locale.locale === target.locale);
  if (summary === undefined) {
    return {
      kind: "failed",
      detail: `the run reported no summary for locale "${target.locale}"`,
    };
  }
  return classifyLocaleSummary(summary, target.key);
}
