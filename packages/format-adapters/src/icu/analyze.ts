import { type MessageFormatElement, parse, TYPE } from "@formatjs/icu-messageformat-parser";
import type { TranslationEntry } from "@verbatra/core";

export interface IcuAnalysis {
  /**
   * Argument names ({name}/{count}) and tag names (<link>) in document order, with every
   * occurrence preserved (not deduplicated) so integrity's multiset check sees true counts.
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

function collect(
  elements: readonly MessageFormatElement[],
  add: (token: string) => void,
  state: { isPlural: boolean },
): void {
  for (const element of elements) {
    const token = tokenOf(element);
    if (token !== undefined) {
      add(token);
    }
    if (element.type === TYPE.plural) {
      state.isPlural = true;
    }
    for (const child of childMessages(element)) {
      collect(child, add, state);
    }
  }
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
    const placeholders: string[] = [];
    const state = { isPlural: false };
    collect(
      ast,
      (token) => {
        placeholders.push(token);
      },
      state,
    );
    return { placeholders, isPlural: state.isPlural, valid: true };
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
