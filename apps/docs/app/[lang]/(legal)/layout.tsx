import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
import { baseOptions } from "@/lib/layout.shared";

export default async function Layout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>;
  children: ReactNode;
}) {
  const { lang } = await params;
  return <HomeLayout {...(await baseOptions(lang as Locale))}>{children}</HomeLayout>;
}
