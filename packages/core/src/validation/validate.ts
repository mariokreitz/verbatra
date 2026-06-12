import type { LocaleResource } from "../model/locale-resource.js";
import { checkPlaceholders } from "../placeholder/integrity.js";
import type {
  PlaceholderFinding,
  ValidateOptions,
  ValidationFinding,
  ValidationReport,
} from "./types.js";

function byKey<T extends ValidationFinding>(findings: T[]): readonly T[] {
  return [...findings].sort((a, b) => a.key.localeCompare(b.key));
}

function collectMissingKeys(source: LocaleResource, target: LocaleResource): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  for (const [key, entry] of source.entries) {
    if (!target.entries.has(key)) {
      findings.push({ key, namespace: entry.namespace, locale: target.locale });
    }
  }
  return findings;
}

function collectBrokenPlaceholders(
  source: LocaleResource,
  target: LocaleResource,
): PlaceholderFinding[] {
  const findings: PlaceholderFinding[] = [];
  for (const [key, sourceEntry] of source.entries) {
    const targetEntry = target.entries.get(key);
    if (targetEntry === undefined) {
      continue;
    }
    const result = checkPlaceholders(sourceEntry.placeholders, targetEntry.placeholders);
    if (!result.matches) {
      findings.push({
        key,
        namespace: targetEntry.namespace,
        locale: target.locale,
        missing: result.missing,
        extra: result.extra,
        reordered: result.reordered,
      });
    }
  }
  return findings;
}

function collectInvalidIcu(
  target: LocaleResource,
  invalidIcuKeys: readonly string[],
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  for (const key of invalidIcuKeys) {
    const entry = target.entries.get(key);
    if (entry !== undefined) {
      findings.push({ key, namespace: entry.namespace, locale: target.locale });
    }
  }
  return findings;
}

/**
 * Build a ValidationReport for a target against its source: keys missing from the
 * target, entries whose placeholders do not match the source, and entries flagged
 * as invalid ICU (supplied via options). Never throws on ordinary problems.
 */
export function validate(
  source: LocaleResource,
  target: LocaleResource,
  options: ValidateOptions = {},
): ValidationReport {
  const missingKeys = byKey(collectMissingKeys(source, target));
  const brokenPlaceholders = byKey(collectBrokenPlaceholders(source, target));
  const invalidIcu = byKey(collectInvalidIcu(target, options.invalidIcuKeys ?? []));

  return {
    isValid: missingKeys.length === 0 && brokenPlaceholders.length === 0 && invalidIcu.length === 0,
    missingKeys,
    brokenPlaceholders,
    invalidIcu,
  };
}
