import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { ReactNode } from "react";
import { toLocale } from "@/lib/i18n";
import { baseOptions } from "@/lib/layout.shared";

export async function LocaleHomeLayout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>;
  children: ReactNode;
}) {
  const { lang } = await params;
  return <HomeLayout {...(await baseOptions(toLocale(lang)))}>{children}</HomeLayout>;
}
