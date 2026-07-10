import type * as PageTree from "fumadocs-core/page-tree";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/lib/i18n";

// Appends a trailing separator plus the llms.txt / llms-full.txt links to a page tree's root
// children, so they render after every real docs section instead of before it. Fumadocs' own
// `links`/`menuItems` mechanism always renders above the page tree with no way to reorder it,
// which is why this goes through the tree data itself rather than DocsLayout's `links` prop.
export async function withLlmsLinks(tree: PageTree.Root, locale: Locale): Promise<PageTree.Root> {
  const t = await getTranslations({ locale, namespace: "docs.llms" });
  const trailer: PageTree.Node[] = [
    { type: "separator", name: t("heading") },
    { type: "page", name: t("index"), url: "/llms.txt", external: true },
    { type: "page", name: t("full"), url: "/llms-full.txt", external: true },
  ];
  return { ...tree, children: [...tree.children, ...trailer] };
}
