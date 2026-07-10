import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";

export default async function Layout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>;
  children: ReactNode;
}) {
  const { lang } = await params;
  const locale = lang as Locale;
  return (
    <DocsLayout {...(await baseOptions(locale))} tree={source.getPageTree(locale)}>
      {children}
    </DocsLayout>
  );
}
