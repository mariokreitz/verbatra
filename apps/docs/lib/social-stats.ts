import { z } from "zod";

// Social-proof stats for the landing TrustStrip.
//
// Server-only module: it is imported only from the server page (no "use client") and must never be
// pulled into a client bundle (it would leak the server-side fetch origins).
//
// These numbers are fetched server-side under Next.js Incremental Static Regeneration (ISR) with a
// 24h revalidation window (see REVALIDATE_SECONDS). The first build bakes a value into the static
// page; afterwards the running Node server serves that cached value and refreshes it in the
// background at most once per day. Both origins (api.github.com, api.npmjs.org) stay entirely
// server-side, so the browser never requests them and no CSP/preconnect surface is added. A failed
// background revalidation keeps serving the last good value rather than breaking the page, and the
// build never fails on a fetch error.
//
// Honesty rules (see briefing 3d): a stat is shown only above a small floor; on any fetch or parse
// failure, timeout, or sub-floor value it is hidden (returned as null). The functions return raw
// integers (or null); the server page does the locale-aware Intl.NumberFormat formatting where the
// active locale is known.

const GITHUB_REPO_URL = "https://api.github.com/repos/mariokreitz/verbatra";
const NPM_DOWNLOADS_BASE = "https://api.npmjs.org/downloads/point/last-month";
const NPM_PACKAGES = ["@verbatra/cli", "@verbatra/sdk"] as const;

// Floors: below these, a stat reads as weakness and is hidden rather than printed.
const STARS_FLOOR = 25;
const DOWNLOADS_FLOOR = 50;

// ISR revalidation window in seconds (24 hours). The server serves the cached value and refreshes
// it in the background at most once per day; the home page exports the same value as its revalidate.
export const REVALIDATE_SECONDS = 86_400;

// Only the integer count is read from each response; no other field is parsed or rendered.
const githubRepoSchema = z.object({ stargazers_count: z.number().int().nonnegative() });
const npmDownloadsSchema = z.object({ downloads: z.number().int().nonnegative() });

export type SocialStats = {
  readonly stars: number | null;
  readonly downloads: number | null;
};

// Server-side fetch under ISR: the response is cached and revalidated at most once per
// REVALIDATE_SECONDS, and a failed request yields no value (null) rather than failing the render.
async function fetchJson(url: string): Promise<unknown> {
  try {
    const response = await fetch(url, {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchStars(): Promise<number | null> {
  const parsed = githubRepoSchema.safeParse(await fetchJson(GITHUB_REPO_URL));
  if (!parsed.success) {
    return null;
  }
  const stars = parsed.data.stargazers_count;
  return stars >= STARS_FLOOR ? stars : null;
}

async function fetchPackageDownloads(pkg: string): Promise<number | null> {
  const parsed = npmDownloadsSchema.safeParse(await fetchJson(`${NPM_DOWNLOADS_BASE}/${pkg}`));
  return parsed.success ? parsed.data.downloads : null;
}

async function fetchDownloads(): Promise<number | null> {
  const counts = await Promise.all(NPM_PACKAGES.map(fetchPackageDownloads));
  // Sum only the endpoints that resolved; if neither resolved, there is no value to show.
  const resolved = counts.filter((count): count is number => count !== null);
  if (resolved.length === 0) {
    return null;
  }
  const total = resolved.reduce((sum, count) => sum + count, 0);
  return total >= DOWNLOADS_FLOOR ? total : null;
}

/**
 * Resolves the landing TrustStrip stats under ISR (revalidated at most once per
 * REVALIDATE_SECONDS): GitHub stars and the summed last-month npm downloads for the published
 * packages. Each stat is the raw integer when it clears its floor and the fetch/parse succeeds,
 * otherwise `null` (a fetch error never fails the build or the render). Callers do the locale-aware
 * formatting.
 */
export async function getSocialStats(): Promise<SocialStats> {
  const [stars, downloads] = await Promise.all([fetchStars(), fetchDownloads()]);
  return { stars, downloads };
}
