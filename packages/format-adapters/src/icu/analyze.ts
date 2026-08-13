import { type MessageFormatElement, parse, TYPE } from "@formatjs/icu-messageformat-parser";
import type { TranslationEntry } from "@verbatra/core";

export interface IcuAnalysis {
  readonly placeholders: readonly string[];
  readonly isPlural: boolean;
  readonly valid: boolean;
}

const VALID_EMPTY: IcuAnalysis = { placeholders: [], isPlural: false, valid: true };
const INVALID: IcuAnalysis = { placeholders: [], isPlural: false, valid: false };

export function tokenOf(element: MessageFormatElement): string | undefined {
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

export function icuPlaceholders(value: string): readonly string[] {
  return analyzeIcuValue(value).placeholders;
}

export function icuIsValid(value: string): boolean {
  return analyzeIcuValue(value).valid;
}

export function icuDeriveEntry(
  _key: string,
  value: string,
): { readonly placeholders: readonly string[]; readonly isPlural: boolean } {
  const analysis = analyzeIcuValue(value);
  return { placeholders: analysis.placeholders, isPlural: analysis.isPlural };
}

export function icuInvalidKeys(entries: ReadonlyMap<string, TranslationEntry>): readonly string[] {
  const invalid: string[] = [];
  for (const [key, entry] of entries) {
    if (!icuIsValid(entry.value)) {
      invalid.push(key);
    }
  }
  return invalid;
}
