import { type MessageFormatElement, parse, TYPE } from "@formatjs/icu-messageformat-parser";

export interface IcuAnalysis {
  /** Argument names ({name}/{count}) and tag names (<link>), first-appearance order. */
  readonly placeholders: readonly string[];
  /** True when a plural or selectordinal argument appears at any nesting level. */
  readonly isPlural: boolean;
  /** False when the value fails to parse as ICU MessageFormat. */
  readonly valid: boolean;
}

const VALID_EMPTY: IcuAnalysis = { placeholders: [], isPlural: false, valid: true };
const INVALID: IcuAnalysis = { placeholders: [], isPlural: false, valid: false };

/** Canonical placeholder token for an element, or undefined for literals and '#'. */
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

/** The nested sub-messages of an element (plural/select branches, tag children). */
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
 * Analyze an ICU MessageFormat value without resolving it: extract argument and tag
 * placeholders, detect a plural/selectordinal argument, and report parse validity.
 * Values with no ICU syntax short-circuit. Any parse failure (including a crafted
 * value too deep to parse) is reported as invalid rather than thrown, so a single
 * bad value never breaks a read.
 */
export function analyzeIcuValue(value: string): IcuAnalysis {
  if (!value.includes("{") && !value.includes("<")) {
    return VALID_EMPTY;
  }
  try {
    const ast = parse(value);
    const seen = new Set<string>();
    const placeholders: string[] = [];
    const state = { isPlural: false };
    collect(
      ast,
      (token) => {
        if (!seen.has(token)) {
          seen.add(token);
          placeholders.push(token);
        }
      },
      state,
    );
    return { placeholders, isPlural: state.isPlural, valid: true };
  } catch {
    return INVALID;
  }
}
