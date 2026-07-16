import { type MessageFormatElement, parse, TYPE } from "@formatjs/icu-messageformat-parser";
import type { TranslationEntry } from "@verbatra/core";

/** The result of analyzing one ICU MessageFormat value without resolving it. */
export interface IcuAnalysis {
  /**
   * Argument names ({name}/{count}) and tag names (<link>) with every occurrence preserved
   * (not deduplicated) so integrity's multiset check sees true counts, except across the sibling
   * branches of the same plural/select node: a placeholder used consistently across every branch
   * is one occurrence, not one per branch, so translating into a language with more CLDR plural
   * categories than the source (for example Polish one/few/many/other versus English one/other)
   * does not inflate the count and trip a false placeholder-integrity mismatch. See `collect` for
   * how branch occurrences are combined.
   */
  readonly placeholders: readonly string[];
  /** True when a plural or selectordinal argument appears at any nesting level. */
  readonly isPlural: boolean;
  /** False when the value fails to parse as ICU MessageFormat. */
  readonly valid: boolean;
}

const VALID_EMPTY: IcuAnalysis = { placeholders: [], isPlural: false, valid: true };
const INVALID: IcuAnalysis = { placeholders: [], isPlural: false, valid: false };

function tokenOf(element: MessageFormatElement): string | undefined {
  switch (element.type) {
    case TYPE.argument:
    case TYPE.number:
    case TYPE.date:
    case TYPE.time:
    case TYPE.select:
    case TYPE.plural:
      return `{${element.value}}`;
    case TYPE.tag:
      return `<${element.value}>`;
    default:
      return undefined;
  }
}

function childMessages(element: MessageFormatElement): readonly MessageFormatElement[][] {
  if (element.type === TYPE.plural || element.type === TYPE.select) {
    return Object.values(element.options).map((option) => option.value);
  }
  if (element.type === TYPE.tag) {
    return [element.children];
  }
  return [];
}

function addCount(target: Map<string, number>, token: string, count: number): void {
  target.set(token, (target.get(token) ?? 0) + count);
}

/**
 * Combine the placeholder multisets of sibling branches (plural/select options, or a tag's single
 * child) into one multiset. A token present in every branch keeps its minimum per-branch count
 * (uniform repetition within each branch is preserved, but the count is not multiplied by the
 * number of branches). A token missing from at least one branch is dropped: the source guaranteed
 * it in every rendering, so a translation must too, and the minimum falling to zero is how a
 * genuine drop from one branch is still caught. A token present in only some branches of a single
 * message (never all) is a known limitation and is not counted; this is a narrow, defensible gap
 * since the source itself never established the placeholder as universally required.
 */
function combineBranches(branchMultisets: readonly Map<string, number>[]): Map<string, number> {
  const combined = new Map<string, number>();
  const tokens = new Set<string>();
  for (const branch of branchMultisets) {
    for (const token of branch.keys()) {
      tokens.add(token);
    }
  }
  for (const token of tokens) {
    const minCount = Math.min(...branchMultisets.map((branch) => branch.get(token) ?? 0));
    if (minCount > 0) {
      combined.set(token, minCount);
    }
  }
  return combined;
}

function collect(
  elements: readonly MessageFormatElement[],
  state: { isPlural: boolean },
): Map<string, number> {
  const result = new Map<string, number>();
  for (const element of elements) {
    const token = tokenOf(element);
    if (token !== undefined) {
      addCount(result, token, 1);
    }
    if (element.type === TYPE.plural) {
      state.isPlural = true;
    }
    const branches = childMessages(element);
    if (branches.length > 0) {
      const branchMultisets = branches.map((branch) => collect(branch, state));
      for (const [branchToken, branchCount] of combineBranches(branchMultisets)) {
        addCount(result, branchToken, branchCount);
      }
    }
  }
  return result;
}

function flatten(multiset: ReadonlyMap<string, number>): string[] {
  const flattened: string[] = [];
  for (const [token, count] of multiset) {
    for (let i = 0; i < count; i += 1) {
      flattened.push(token);
    }
  }
  return flattened;
}

/**
 * Analyze an ICU MessageFormat value without resolving it: extract argument and tag placeholders,
 * detect a plural/selectordinal argument, and report parse validity. Any parse failure is reported as
 * invalid rather than thrown, so a single bad value never breaks a read.
 */
export function analyzeIcuValue(value: string): IcuAnalysis {
  if (!value.includes("{") && !value.includes("<")) {
    return VALID_EMPTY;
  }
  try {
    const ast = parse(value);
    const state = { isPlural: false };
    const multiset = collect(ast, state);
    return { placeholders: flatten(multiset), isPlural: state.isPlural, valid: true };
  } catch {
    return INVALID;
  }
}

/** The ICU placeholders of a value, the `extractPlaceholders` hook for ICU formats (next-intl, ARB). */
export function icuPlaceholders(value: string): readonly string[] {
  return analyzeIcuValue(value).placeholders;
}

/** Whether a value parses as ICU MessageFormat, the `validateMessage` hook for ICU formats. */
export function icuIsValid(value: string): boolean {
  return analyzeIcuValue(value).valid;
}

/** The `deriveEntry` hook for ICU formats: placeholders and plurality from the ICU analysis. */
export function icuDeriveEntry(
  _key: string,
  value: string,
): { readonly placeholders: readonly string[]; readonly isPlural: boolean } {
  const analysis = analyzeIcuValue(value);
  return { placeholders: analysis.placeholders, isPlural: analysis.isPlural };
}

/** The `computeInvalidIcuKeys` hook for ICU formats: the keys whose values fail to parse. */
export function icuInvalidKeys(entries: ReadonlyMap<string, TranslationEntry>): readonly string[] {
  const invalid: string[] = [];
  for (const [key, entry] of entries) {
    if (!icuIsValid(entry.value)) {
      invalid.push(key);
    }
  }
  return invalid;
}
