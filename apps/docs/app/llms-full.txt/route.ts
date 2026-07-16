import { i18n } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";
import { source } from "@/lib/source";

/** Rendered at build time; the content only changes with a rebuild. */
export const dynamic = "force-static";

async function renderPage(page: ReturnType<typeof source.getPages>[number]): Promise<string> {
  const url = new URL(page.url, SITE_URL).href;
  const markdown = await page.data.getText("processed");
  return `# ${page.data.title} (${url})\n\n${markdown}`;
}

/**
 * Serves the full docs corpus as one plain-text file for AI agents. Only the
 * default-locale pages are exported; the i18n-aware loader would otherwise
 * repeat each page per locale.
 */
export async function GET(): Promise<Response> {
  const pages = source.getPages(i18n.defaultLanguage);
  const sections = await Promise.all(pages.map(renderPage));

  const body = `# verbatra (full documentation)

> This is the complete verbatra documentation in a single file, for AI agents that ingest
> content directly. For a curated index of links instead, see ${SITE_URL}/llms.txt.

${sections.join("\n\n---\n\n")}
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
