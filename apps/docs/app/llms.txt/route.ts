import { i18n } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";
import { source } from "@/lib/source";

/** Rendered at build time; the content only changes with a rebuild. */
export const dynamic = "force-static";

/**
 * Serves the llms.txt index: a project summary plus a link list of every
 * default-locale docs page. The i18n-aware loader would otherwise repeat each
 * page per locale.
 */
export function GET(): Response {
  const docs = source
    .getPages(i18n.defaultLanguage)
    .map((page) => {
      const url = new URL(page.url, SITE_URL).href;
      const desc = page.data.description ? `: ${page.data.description}` : "";
      return `- [${page.data.title}](${url})${desc}`;
    })
    .join("\n");

  const body = `# verbatra

> verbatra is a CLI and SDK that keeps your i18n locale files in sync, translating only the keys that changed through your choice of AI or machine-translation provider.

verbatra is open source and MIT licensed. You maintain one source locale; on each run it diffs the source against a committed lock file and sends only the new or changed keys to your provider, leaving current translations untouched. Placeholder and ICU integrity are checked after every translation, and any result that breaks a placeholder is withheld.

- Repository: https://github.com/mariokreitz/verbatra
- npm packages: @verbatra/cli (the \`verbatra\` command), @verbatra/sdk (programmatic API)
- Translation providers: Anthropic, OpenAI, Gemini, DeepL, openai-compatible (local or self-hosted)
- i18n formats: i18next, vue-i18n, next-intl, ngx-translate, Flutter ARB, YAML, and XLIFF
- Frameworks: React, Vue, Angular, Node.js, Flutter
- Requires Node.js >= 22.14.0

## Documentation

${docs}
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
