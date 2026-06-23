import { z } from "zod";

// Build-time social-proof stats for the landing TrustStrip.
//
// Server-only module: it is imported only from the server page (no "use client"), runs at build
// time, and must never be pulled into a client bundle (it would leak the build-side fetch origins).
//
// These numbers are fetched once during `next build` (SSG) and baked into the static page as
// on-brand text. There is no client runtime fetch: both origins (api.github.com, api.npmjs.org)
// stay entirely build-side, so the browser never requests them and no CSP/preconnect surface is
// added. The cost is staleness: the numbers reflect the last build, refreshed on the next rebuild.
//
// Honesty rules (see briefing 3d): a stat is shown only above a small floor; on any fetch or parse
// failure, timeout, or sub-floor value it is hidden (returned as null). The build never fails on a
// fetch error. The functions return raw integers (or null); the server page does the locale-aware
// Intl.NumberFormat formatting where the active locale is known.

const GITHUB_REPO_URL = "https://api.github.com/repos/mariokreitz/verbatra";
const NPM_DOWNLOADS_BASE = "https://api.npmjs.org/downloads/point/last-month";
const NPM_PACKAGES = ["@verbatra/cli", "@verbatra/sdk"] as const;

// Floors: below these, a stat reads as weakness and is hidden rather than printed.
const STARS_FLOOR = 25;
const DOWNLOADS_FLOOR = 50;

// Only the integer count is read from each response; no other field is parsed or rendered.
const githubRepoSchema = z.object({ stargazers_count: z.number().int().nonnegative() });
const npmDownloadsSchema = z.object({ downloads: z.number().int().nonnegative() });

export type SocialStats = {
  readonly stars: number | null;
  readonly downloads: number | null;
};

// Build-time fetch: static-friendly cache so the value is fetched once during the build, and a
// failed request yields no value (null) rather than failing the build.
async function fetchJson(url: string): Promise<unknown> {
  try {
    const response = await fetch(url, {
      cache: "force-cache",
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
 * Resolves the landing TrustStrip stats at build time: GitHub stars and the summed last-month
 * npm downloads for the published packages. Each stat is the raw integer when it clears its floor
 * and the fetch/parse succeeds, otherwise `null` (the build never fails on a fetch error). Callers
 * do the locale-aware formatting.
 */
export async function getSocialStats(): Promise<SocialStats> {
  const [stars, downloads] = await Promise.all([fetchStars(), fetchDownloads()]);
  return { stars, downloads };
}
