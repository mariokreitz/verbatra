import type { RpcResultFor } from "../shared/rpc/contract.js";

/** One target locale's key-integrity entry from an already-loaded `key.integrity` result. */
export type KeyIntegrityLocaleEntry = RpcResultFor<"key.integrity">["locales"][number];

/** The three tones an integrity pill renders with, all drawn from Badge's existing tone set. */
export type IntegrityPillTone = "success" | "neutral" | "danger";

/** A pill ready to render: its tone, its label, and an optional mismatch detail string. */
export interface IntegrityPillView {
  readonly tone: IntegrityPillTone;
  readonly label: string;
  readonly detail: string | null;
}

function formatMismatchDetail(missing: readonly string[], extra: readonly string[]): string {
  const parts: string[] = [];
  if (missing.length > 0) {
    parts.push(`missing ${missing.join(", ")}`);
  }
  if (extra.length > 0) {
    parts.push(`extra ${extra.join(", ")}`);
  }
  return parts.join("; ");
}

/**
 * Derives one locale's integrity pill from an already-loaded `key.integrity` result. Returns
 * `null` when the requested locale carries no entry: the key is not "changed" there (missing,
 * orphaned, already in sync, or the result has not been fetched for that locale), so there is
 * nothing to render.
 *
 * A mismatch always takes precedence, checked before `hasPlaceholders`: a source value with no
 * placeholders of its own can still receive an invented one in translation (`matches: false`,
 * `extra` non-empty), which is a real integrity violation, not a "nothing to check" case. Once
 * placeholders match, an ICU-invalid target value is checked next, also before `hasPlaceholders`:
 * a source with no placeholders of its own can still receive a target that is malformed ICU
 * message syntax, which must render danger, not the "nothing to check" neutral state. Only once
 * both checks pass does `hasPlaceholders` decide between a trivial match (no placeholders on
 * either side, nothing was actually checked) and a meaningful one.
 */
export function deriveIntegrityPillView(
  locales: readonly KeyIntegrityLocaleEntry[],
  locale: string,
): IntegrityPillView | null {
  const entry = locales.find((candidate) => candidate.locale === locale);
  if (entry === undefined) {
    return null;
  }
  if (!entry.matches) {
    return {
      tone: "danger",
      label: "Placeholder mismatch",
      detail: formatMismatchDetail(entry.missing, entry.extra),
    };
  }
  if (!entry.icuValid) {
    return { tone: "danger", label: "Invalid message syntax", detail: null };
  }
  if (!entry.hasPlaceholders) {
    return { tone: "neutral", label: "No placeholders", detail: null };
  }
  return { tone: "success", label: "Placeholders match", detail: null };
}
