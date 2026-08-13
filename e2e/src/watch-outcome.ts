import type { JsonEnvelope } from "./harness.js";

export interface WatchNotice {
  readonly code: string;
  readonly message: string;
}

export interface WatchLocaleSummary {
  readonly locale: string;
  readonly status?: "succeeded" | "partial" | "failed";
  readonly translated?: readonly string[];
  readonly unchanged?: readonly string[];
  readonly cacheHits?: readonly string[];
  readonly generated?: readonly string[];
  readonly providerFailures?: readonly string[];
  readonly integrityMismatches?: readonly string[];
  readonly budgetWithheld?: readonly string[];
  readonly notices?: readonly WatchNotice[];
  readonly error?: WatchNotice;
}

export interface WatchRunSummary {
  readonly locales?: readonly WatchLocaleSummary[];
}

export interface WatchTarget {
  readonly locale: string;
  readonly key: string;
}

export type KeyOutcome =
  | { readonly kind: "delivered" }
  | { readonly kind: "throttled"; readonly detail: string }
  | { readonly kind: "failed"; readonly detail: string }
  | { readonly kind: "pending" };

export type SettledKeyOutcome = Exclude<KeyOutcome, { readonly kind: "pending" }>;

const RATE_LIMITED_NOTICE_PATTERN = /\(RATE_LIMITED:/;

const WITHHELD_SUB_BATCH_CODE = "SUB_BATCH_FAILED";

const RATE_LIMITED_CODE = "RATE_LIMITED";

function acceptedKeys(summary: WatchLocaleSummary): readonly string[] {
  return [
    ...(summary.translated ?? []),
    ...(summary.unchanged ?? []),
    ...(summary.cacheHits ?? []),
    ...(summary.generated ?? []),
  ];
}

function describeNotices(summary: WatchLocaleSummary): string {
  return (summary.notices ?? []).map((notice) => `${notice.code}: ${notice.message}`).join("; ");
}

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

function classifyLocaleError(summary: WatchLocaleSummary, error: WatchNotice): KeyOutcome {
  if (error.code === RATE_LIMITED_CODE) {
    return { kind: "throttled", detail: `locale "${summary.locale}" was rate-limited` };
  }
  return {
    kind: "failed",
    detail: `locale "${summary.locale}" failed (${error.code}: ${error.message})`,
  };
}

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
