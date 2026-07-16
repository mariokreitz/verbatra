/**
 * The dashboard's page vocabulary and its URL-hash routing: which pages exist, which one is the
 * default workspace, and how a `location.hash` maps to a page and back. Hash-based so the page
 * survives a reload and browser back/forward work, without any server-side route surface: the
 * hash never reaches the server, and the session token in the query string stays untouched.
 */

/** Every page, in sidebar order: the two work surfaces first, then the two reference pages. */
export const PAGE_IDS = ["translations", "review", "activity", "settings"] as const;

/** One page's identifier, drawn from {@link PAGE_IDS}. */
export type PageId = (typeof PAGE_IDS)[number];

/** Where a fresh session lands: the daily workspace. */
export const DEFAULT_PAGE: PageId = "translations";

function isPageId(value: string): value is PageId {
  return (PAGE_IDS as readonly string[]).includes(value);
}

/**
 * Parses a raw `location.hash` into a page. Accepts "#/review" (the canonical form this module
 * writes) and the bare "#review"; anything else, including an empty hash on first open or a
 * stale hash from an older version of the dashboard, falls back to {@link DEFAULT_PAGE} rather
 * than erroring: a hash is a convenience, never a contract.
 */
export function parsePageHash(hash: string): PageId {
  const candidate = hash.replace(/^#\/?/, "");
  return isPageId(candidate) ? candidate : DEFAULT_PAGE;
}

/** The canonical hash for a page, what navigation writes into the URL. */
export function pageHash(page: PageId): string {
  return `#/${page}`;
}
