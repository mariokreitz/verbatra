import {
  checkPlaceholders,
  contentHash,
  diffResources,
  type LocaleResource,
  type TranslationEntry,
} from "@verbatra/core";
import type { WorkbookRow, WorkbookSheet } from "@verbatra/exchange";
import type { FormatAdapter } from "@verbatra/format-adapters";
import type { LocaleSummary, SdkNotice } from "../summary.js";

/** Everything one locale's import needs; the orchestrator supplies it per data sheet. */
export interface ImportLocaleParams {
  readonly sheet: WorkbookSheet;
  readonly source: LocaleResource;
  readonly target: LocaleResource;
  readonly baseline: ReadonlyMap<string, string>;
  readonly adapter: FormatAdapter;
  /** Source keys flagged invalid-ICU on read; surfaced verbatim, exactly as the provider path. */
  readonly sourceInvalidIcuKeys: readonly string[];
}

/** The judged outcome of one locale's rows, before any write or lock update. */
export interface ImportLocaleResult {
  readonly summary: LocaleSummary;
  /** The accepted values to merge into the target, keyed by key. Empty when nothing passed. */
  readonly accepted: ReadonlyMap<
    string,
    { readonly value: string; readonly source: TranslationEntry }
  >;
  /**
   * Keys judged but not accepted this run (drift, placeholder, ICU), for diagnostics and testing only.
   * Lock-baseline retention is driven by absence from `accepted` (see `computeLockEntries` in
   * import-workbook.ts), not by membership here: a blank changed row keeps its prior baseline too, even
   * though it is never classified into this set.
   */
  readonly withheld: ReadonlySet<string>;
}

/** A row identifier that maps to no known key: a broken round trip, rejected fail-safe. */
export class UnknownKeyError extends Error {
  readonly key: string;
  constructor(key: string) {
    super(`The workbook has a row with key "${key}" that maps to no known source or target key.`);
    this.name = "UnknownKeyError";
    this.key = key;
  }
}

/** A filled row that maps to no known source key AND no known target key: an invented key. */
function isUnknownKey(row: WorkbookRow, source: LocaleResource, target: LocaleResource): boolean {
  return !source.entries.has(row.key) && !target.entries.has(row.key);
}

type Reason = "drift" | "placeholder" | "icu";

/**
 * Judge one filled row against the live source. Returns `undefined` to accept, or the first failing
 * reason: `"drift"` when the row's export-time source hash no longer matches the current source
 * (the source changed since export), `"placeholder"` when the translation's placeholder set differs
 * from the source's, or `"icu"` when the adapter reports the value invalid for the format's syntax.
 */
function judge(
  row: WorkbookRow,
  sourceEntry: TranslationEntry,
  adapter: FormatAdapter,
): Reason | undefined {
  if (contentHash(sourceEntry) !== row.sourceHash) {
    return "drift";
  }
  const integrity =
    adapter.comparePlaceholders !== undefined
      ? adapter.comparePlaceholders(sourceEntry.value, row.translation)
      : checkPlaceholders(sourceEntry.placeholders, adapter.extractPlaceholders(row.translation));
  if (!integrity.matches) {
    return "placeholder";
  }
  if (!adapter.validateMessage(row.translation)) {
    return "icu";
  }
  return undefined;
}

interface Buckets {
  readonly accepted: Map<string, { value: string; source: TranslationEntry }>;
  readonly mismatches: string[];
  readonly withheld: Set<string>;
  /** Blank cells for a source key whose current hash no longer matches the recorded baseline. */
  readonly blankDrifted: Set<string>;
}

/**
 * A blank cell for a key whose source drifted since its baseline was recorded must not let the
 * baseline advance silently: flag it so the lock keeps the prior hash and the run reports it.
 */
function trackBlankDrift(row: WorkbookRow, params: ImportLocaleParams, buckets: Buckets): void {
  const sourceEntry = params.source.entries.get(row.key);
  if (sourceEntry === undefined) {
    return;
  }
  const priorHash = params.baseline.get(row.key);
  if (priorHash !== undefined && priorHash !== contentHash(sourceEntry)) {
    buckets.blankDrifted.add(row.key);
  }
}

/**
 * Apply the fail-safe row rules: empty cells are skipped, an invented key throws {@link UnknownKeyError},
 * an orphaned source key is left unwritten, and every other filled row is judged (accepted or withheld).
 */
function classifyRows(params: ImportLocaleParams, buckets: Buckets): void {
  for (const row of params.sheet.rows) {
    if (row.translation === "") {
      trackBlankDrift(row, params, buckets);
      continue;
    }
    if (isUnknownKey(row, params.source, params.target)) {
      throw new UnknownKeyError(row.key);
    }
    const sourceEntry = params.source.entries.get(row.key);
    if (sourceEntry === undefined) {
      // Source deleted since export: surfaced via the orphaned diff bucket, never written.
      continue;
    }
    const reason = judge(row, sourceEntry, params.adapter);
    if (reason === undefined) {
      buckets.accepted.set(row.key, { value: row.translation, source: sourceEntry });
    } else {
      buckets.mismatches.push(row.key);
      buckets.withheld.add(row.key);
    }
  }
}

/** A secret-free notice for blank cells whose prior lock baseline was kept instead of advanced. */
function blankRowBaselineNotice(count: number): SdkNotice {
  return {
    code: "BLANK_ROW_BASELINE_RETAINED",
    message:
      `${count} row(s) were left blank for a key whose source changed since the row's baseline ` +
      "was recorded; the prior baseline was kept so the drift keeps being reported.",
  };
}

/**
 * Judge one locale's filled rows with the core checks (drift, placeholder, ICU) and partition its keys
 * into the summary buckets. Writes nothing and updates no lock; throws {@link UnknownKeyError} on a
 * broken round trip.
 */
export function importLocale(params: ImportLocaleParams): ImportLocaleResult {
  const diff = diffResources(params.source, params.target, { baseline: params.baseline });
  const buckets: Buckets = {
    accepted: new Map(),
    mismatches: [],
    withheld: new Set(),
    blankDrifted: new Set(),
  };
  classifyRows(params, buckets);

  // Surface source keys that are invalid-ICU and appear as a row in this sheet (source-side, not the
  // filled value's ICU validity, which is reported under integrityMismatches).
  const rowKeys = new Set(params.sheet.rows.map((row) => row.key));
  const invalidIcuSource = [...new Set(params.sourceInvalidIcuKeys)]
    .filter((key) => rowKeys.has(key))
    .sort();

  const summary: LocaleSummary = {
    locale: params.sheet.locale,
    status: "succeeded",
    translated: [...buckets.accepted.keys()].sort(),
    unchanged: diff.unchanged,
    orphaned: diff.orphaned,
    // Import never prunes: orphans are reported but never removed here (pruning is a translate-flow concern).
    pruned: [],
    invalidIcuSource,
    integrityMismatches: [...buckets.mismatches].sort(),
    // A workbook import never calls a provider, so a provider-call failure cannot occur here.
    providerFailures: [],
    // A workbook import never calls a provider, so the budget guardrail never withholds anything here.
    budgetWithheld: [],
    // Plural generation is a translate-flow concern; the manual workbook import never generates forms.
    generated: [],
    notices:
      buckets.blankDrifted.size > 0 ? [blankRowBaselineNotice(buckets.blankDrifted.size)] : [],
  };
  return { summary, accepted: buckets.accepted, withheld: buckets.withheld };
}
