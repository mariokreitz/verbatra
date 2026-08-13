export type I18nextPluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

export function isPluralKey(key: string): boolean {
  return PLURAL_SUFFIX.test(key);
}

export function pluralCategoryOf(key: string): I18nextPluralCategory | undefined {
  const match = PLURAL_SUFFIX.exec(key);
  return match?.[1] as I18nextPluralCategory | undefined;
}

export function pluralBaseKey(key: string): string | undefined {
  if (!isPluralKey(key)) {
    return undefined;
  }
  return key.replace(PLURAL_SUFFIX, "");
}

export function makePluralKey(baseKey: string, category: I18nextPluralCategory): string {
  return `${baseKey}_${category}`;
}
