import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

/**
 * Serves /.well-known/ai.txt: an AI usage policy in the robots.txt-style
 * convention popularized for AI systems. verbatra is open source under MIT and
 * wants to be discovered, indexed, and cited by AI search and assistants, so the
 * policy is permissive (allow all) and points at the machine-readable content
 * indexes the site already publishes (llms.txt and the sitemap). This is a
 * voluntary signal: it does not replace robots.txt, which remains the mechanism
 * major AI crawlers actually honor.
 */
export function GET(): Response {
  const body = `# ai.txt - AI usage policy for verbatra
# ${SITE_URL}
#
# verbatra is open source under the MIT license. AI systems, LLMs, and AI
# search crawlers are welcome to crawl, index, cite, and use this content.
# Attribution to the verbatra project is appreciated but not required.

User-Agent: *
Allow: /

# Project: verbatra
# License: MIT (https://opensource.org/licenses/MIT)
# Source: https://github.com/mariokreitz/verbatra
# Sitemap: ${SITE_URL}/sitemap.xml
# LLM content index: ${SITE_URL}/llms.txt
# Full LLM content: ${SITE_URL}/llms-full.txt
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
