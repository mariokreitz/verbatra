import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { ReactNode } from "react";
import { toLocale } from "@/lib/i18n";
import { baseOptions } from "@/lib/layout.shared";

/**
 * The Fumadocs `HomeLayout` shell shared by every route group that isn't the docs
 * tree itself (marketing home, legal pages): same nav, same locale switcher, same
 * theming, nothing route-group-specific.
 */
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
