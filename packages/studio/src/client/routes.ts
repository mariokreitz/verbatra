export const PAGE_IDS = ["translations", "review", "activity", "settings"] as const;

export type PageId = (typeof PAGE_IDS)[number];

export const DEFAULT_PAGE: PageId = "translations";

function isPageId(value: string): value is PageId {
  return (PAGE_IDS as readonly string[]).includes(value);
}

export function parsePageHash(hash: string): PageId {
  const candidate = hash.replace(/^#\/?/, "");
  return isPageId(candidate) ? candidate : DEFAULT_PAGE;
}

export function pageHash(page: PageId): string {
  return `#/${page}`;
}
