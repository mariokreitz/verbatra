// The single canonical host for the site. Every absolute URL (metadataBase, og:url,
// sitemap entries, robots) is derived from this so the canonical host never drifts.
// Non-www is the canonical host; the www host 301-redirects to it at the proxy.
export const SITE_URL = "https://verbatra.kreitz-webdev.de";
