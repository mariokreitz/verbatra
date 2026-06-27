import { z } from "zod";

// Server-only social-proof stats for the landing TrustStrip: must never be pulled into a client bundle (it would leak the fetch origins).
// Fetched server-side under ISR with a 24h revalidation window; a stat is hidden (null) on any fetch or parse failure or when it falls below its floor.

const GITHUB_REPO_URL = "https://api.github.com/repos/mariokreitz/verbatra";
const NPM_DOWNLOADS_BASE = "https://api.npmjs.org/downloads/point/last-month";
const NPM_PACKAGES = ["@verbatra/cli", "@verbatra/sdk"] as const;
// The published @verbatra/cli version drives the displayed version (sdk and cli are version-locked).
const NPM_VERSION_URL = "https://registry.npmjs.org/@verbatra/cli/latest";

// Below these floors a stat reads as weakness and is hidden rather than printed.
const STARS_FLOOR = 25;
const DOWNLOADS_FLOOR = 50;

// ISR revalidation window (24h); the home page mirrors this value as its revalidate.
export const REVALIDATE_SECONDS = 86_400;

const githubRepoSchema = z.object({ stargazers_count: z.number().int().nonnegative() });
const npmDownloadsSchema = z.object({ downloads: z.number().int().nonnegative() });
const npmVersionSchema = z.object({ version: z.string().min(1) });

export type SocialStats = {
  readonly stars: number | null;
  readonly downloads: number | null;
};

// A failed request yields null rather than failing the render.
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
  const resolved = counts.filter((count): count is number => count !== null);
  if (resolved.length === 0) {
    return null;
  }
  const total = resolved.reduce((sum, count) => sum + count, 0);
  return total >= DOWNLOADS_FLOOR ? total : null;
}

/**
 * Resolves the landing TrustStrip stats: GitHub stars and the summed last-month npm downloads.
 * Each stat is the raw integer when it clears its floor, otherwise `null`. Callers do the formatting.
 */
export async function getSocialStats(): Promise<SocialStats> {
  const [stars, downloads] = await Promise.all([fetchStars(), fetchDownloads()]);
  return { stars, downloads };
}

/**
 * Resolves the latest published @verbatra/cli version from the npm registry under the same 24h ISR
 * window as the stats, so the displayed version refreshes daily and on every build. Returns `null`
 * on any failure; callers fall back to the build-time PACKAGE_VERSION.
 */
export async function getLatestVersion(): Promise<string | null> {
  const parsed = npmVersionSchema.safeParse(await fetchJson(NPM_VERSION_URL));
  return parsed.success ? parsed.data.version : null;
}
