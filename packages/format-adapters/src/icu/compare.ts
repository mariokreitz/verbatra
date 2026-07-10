import {
  type MessageFormatElement,
  type PluralElement,
  parse,
  type SelectElement,
  type TagElement,
  TYPE,
} from "@formatjs/icu-messageformat-parser";
import { checkPlaceholders, type PlaceholderIntegrityResult } from "@verbatra/core";
import { icuPlaceholders } from "./analyze.js";

/** An ICU plural or select element, the two node kinds with named CLDR-category branches. */
type BranchingElement = PluralElement | SelectElement;

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

function isBranching(element: MessageFormatElement): element is BranchingElement {
  return element.type === TYPE.plural || element.type === TYPE.select;
}

function isTag(element: MessageFormatElement): element is TagElement {
  return element.type === TYPE.tag;
}

/** The token each element in this list contributes at its own nesting layer, not descending further. */
function layerTokens(elements: readonly MessageFormatElement[]): string[] {
  const tokens: string[] = [];
  for (const element of elements) {
    const token = tokenOf(element);
    if (token !== undefined) {
      tokens.push(token);
    }
  }
  return tokens;
}

/**
 * Every token anywhere under `elements`, descending into every plural/select branch and tag body,
 * with no branch combination (a union, not a per-branch minimum): used to build the "does this token
 * legitimately appear anywhere in the source" set for a target-only CLDR category.
 */
function deepTokens(elements: readonly MessageFormatElement[]): string[] {
  const tokens: string[] = [];
  for (const element of elements) {
    const token = tokenOf(element);
    if (token !== undefined) {
      tokens.push(token);
    }
    if (isTag(element)) {
      tokens.push(...deepTokens(element.children));
    } else if (isBranching(element)) {
      for (const option of Object.values(element.options)) {
        tokens.push(...deepTokens(option.value));
      }
    }
  }
  return tokens;
}

/** A branching element's sibling branches keyed by their CLDR category, category identity preserved. */
function branchesByCategory(
  element: BranchingElement,
): Map<string, readonly MessageFormatElement[]> {
  return new Map(
    Object.entries(element.options).map(([category, option]) => [category, option.value]),
  );
}

function findMatchingBranching(
  source: BranchingElement,
  target: readonly MessageFormatElement[],
): BranchingElement | undefined {
  return target.find(
    (candidate): candidate is BranchingElement =>
      isBranching(candidate) && candidate.type === source.type && candidate.value === source.value,
  );
}

function findMatchingTag(
  source: TagElement,
  target: readonly MessageFormatElement[],
): TagElement | undefined {
  return target.find(
    (candidate): candidate is TagElement => isTag(candidate) && candidate.value === source.value,
  );
}

/**
 * Merge several per-layer/per-branch results into one; `reordered` collapses to false, see Decision 2.3.
 * `nestedResults` is only called with at least one recursed pair, and `compareBranching`'s `results`
 * always has at least one entry (a matched target node has at least its mandatory "other" branch), so an
 * empty array never reaches this function; the merge below already produces the correct
 * `{ matches: true, missing: [], extra: [] }` for one anyway, with no separate empty-array case needed.
 */
function combineResults(
  results: readonly PlaceholderIntegrityResult[],
): PlaceholderIntegrityResult {
  const missing = results.flatMap((result) => result.missing).sort();
  const extra = results.flatMap((result) => result.extra).sort();
  return { matches: missing.length === 0 && extra.length === 0, missing, extra, reordered: false };
}

/**
 * A target-only CLDR category (the target locale's cardinality is richer than the source's): check the
 * branch's tokens only for extras against the union of every source branch, never for missing, since the
 * source imposes no requirement on a category it does not have.
 */
function compareAgainstSourceUnion(
  sourceBranches: ReadonlyMap<string, readonly MessageFormatElement[]>,
  targetBranch: readonly MessageFormatElement[],
): PlaceholderIntegrityResult {
  const union = new Set<string>();
  for (const branch of sourceBranches.values()) {
    for (const token of deepTokens(branch)) {
      union.add(token);
    }
  }
  const extra = deepTokens(targetBranch)
    .filter((token) => !union.has(token))
    .sort();
  return { matches: extra.length === 0, missing: [], extra, reordered: false };
}

/** Compare a matched plural/select pair branch by branch, over the union of both sides' categories. */
function compareBranching(
  source: BranchingElement,
  target: BranchingElement,
): PlaceholderIntegrityResult {
  const sourceBranches = branchesByCategory(source);
  const targetBranches = branchesByCategory(target);
  const categories = new Set([...sourceBranches.keys(), ...targetBranches.keys()]);
  const results: PlaceholderIntegrityResult[] = [];
  for (const category of categories) {
    const sourceBranch = sourceBranches.get(category);
    const targetBranch = targetBranches.get(category);
    if (sourceBranch !== undefined && targetBranch !== undefined) {
      results.push(compareElements(sourceBranch, targetBranch));
    } else if (targetBranch !== undefined) {
      results.push(compareAgainstSourceUnion(sourceBranches, targetBranch));
    }
    // Source-only category: no target branch to compare against, skip (see Decision 2).
  }
  return combineResults(results);
}

/** Recurse into every matched plural/select or tag pair at this nesting level, merging their results. */
function nestedResults(
  source: readonly MessageFormatElement[],
  target: readonly MessageFormatElement[],
): PlaceholderIntegrityResult[] {
  const results: PlaceholderIntegrityResult[] = [];
  for (const element of source) {
    if (isBranching(element)) {
      const match = findMatchingBranching(element, target);
      if (match !== undefined) {
        results.push(compareBranching(element, match));
      }
    } else if (isTag(element)) {
      const match = findMatchingTag(element, target);
      if (match !== undefined) {
        results.push(compareElements(element.children, match.children));
      }
    }
  }
  return results;
}

/**
 * Compare two ICU element lists at one nesting level: the level's own tokens directly, plus every
 * matched plural/select or tag pair recursively. An unmatched (renamed) node's branch contents are not
 * further compared; the rename itself is already caught by the flat token comparison at this level.
 */
function compareElements(
  source: readonly MessageFormatElement[],
  target: readonly MessageFormatElement[],
): PlaceholderIntegrityResult {
  const layer = checkPlaceholders(layerTokens(source), layerTokens(target));
  const nested = nestedResults(source, target);
  return nested.length === 0 ? layer : combineResults([layer, ...nested]);
}

/**
 * Branch-aware placeholder-integrity comparison for ICU MessageFormat values: parses both values and
 * walks their plural/select branches against each other, category by category, instead of independently
 * flattening each side into one multiset first (see the ADR at
 * `.verbatra/adr/bts-104-icu-branch-aware-placeholder-integrity.md`). Reuses `checkPlaceholders` from
 * `@verbatra/core` as the leaf comparison primitive; core's contract is untouched.
 *
 * A placeholder invented in a single branch of the target is now flagged as extra, even when the source
 * never established that placeholder as universal. A placeholder legitimately present in only some of the
 * SOURCE's branches never causes a correctly-translated target to be rejected. If either value fails to
 * parse as ICU MessageFormat, this falls back to the existing flat comparison
 * (`icuPlaceholders` + `checkPlaceholders`), the same behavior as before this function existed; a parse
 * failure is a separate signal (`icuIsValid`/`icuInvalidKeys`), not this function's job.
 *
 * @param sourceValue - The source ICU MessageFormat value.
 * @param targetValue - The translated ICU MessageFormat value to check against it.
 * @returns The merged placeholder-integrity result across every nesting level and branch.
 */
export function compareIcuPlaceholders(
  sourceValue: string,
  targetValue: string,
): PlaceholderIntegrityResult {
  try {
    const sourceAst = parse(sourceValue);
    const targetAst = parse(targetValue);
    return compareElements(sourceAst, targetAst);
  } catch {
    return checkPlaceholders(icuPlaceholders(sourceValue), icuPlaceholders(targetValue));
  }
}
