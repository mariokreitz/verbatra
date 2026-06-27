import versionData from "./version.generated.json";

export const SITE_URL = "https://verbatra.kreitz-webdev.de";

// Build-time fallback version, regenerated from @verbatra/cli by scripts/sync-version.mjs
// on every dev and build. The landing page prefers the live npm value (getLatestVersion)
// and falls back to this when the registry is unreachable.
export const PACKAGE_VERSION = versionData.version;

// Single source of truth for the "Last updated" date on both legal pages; do not duplicate it in the catalogs.
export const LEGAL_LAST_UPDATED = "2026-06-21";
