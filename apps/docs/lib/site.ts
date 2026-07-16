import versionData from "./version.generated.json";

/** The canonical production origin of the docs site. */
export const SITE_URL = "https://verbatra.kreitz-webdev.de";

/**
 * Build-time package version, regenerated from @verbatra/cli by
 * scripts/sync-version.mjs on every dev and build. It feeds the home page
 * SoftwareApplication JSON-LD; the visible version badges are live external
 * images, so no runtime registry fetch is needed.
 */
export const PACKAGE_VERSION = versionData.version;

/** Single source of truth for the "Last updated" date on both legal pages; not duplicated in the catalogs. */
export const LEGAL_LAST_UPDATED = "2026-07-02";
