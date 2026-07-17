import type * as PageTree from "fumadocs-core/page-tree";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/lib/i18n";

export async function withLlmsLinks(tree: PageTree.Root, locale: Locale): Promise<PageTree.Root> {
  const t = await getTranslations({ locale, namespace: "docs.llms" });
  const trailer: PageTree.Node[] = [
    { type: "separator", name: t("heading") },
    { type: "page", name: t("index"), url: "/llms.txt", external: true },
    { type: "page", name: t("full"), url: "/llms-full.txt", external: true },
  ];
  return { ...tree, children: [...tree.children, ...trailer] };
}
