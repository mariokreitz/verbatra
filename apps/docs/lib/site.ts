import versionData from "./version.generated.json";

export const SITE_URL = "https://verbatra.kreitz-webdev.de";

// Build-time version, regenerated from @verbatra/cli by scripts/sync-version.mjs on every
// dev and build. It feeds the home page SoftwareApplication JSON-LD; the visible version
// badges are live external images, so no runtime registry fetch is needed.
export const PACKAGE_VERSION = versionData.version;

// Single source of truth for the "Last updated" date on both legal pages; do not duplicate it in the catalogs.
export const LEGAL_LAST_UPDATED = "2026-06-21";
