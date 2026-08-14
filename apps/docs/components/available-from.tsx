import { Callout } from "fumadocs-ui/components/callout";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n";

export type AvailableFromProps = {
  version: string;
  pkg?: string;
};

export async function AvailableFrom({
  version,
  pkg,
  locale,
}: AvailableFromProps & { locale: Locale }): Promise<ReactNode> {
  const t = await getTranslations({ locale, namespace: "docs.availableFrom" });
  if (pkg === undefined) {
    return (
      <Callout type="info" title={t("title", { version })}>
        {t("text", { version })}
      </Callout>
    );
  }
  const release = `${pkg} ${version}`;
  return (
    <Callout type="info" title={t("packageTitle", { version: release })}>
      {t("packageText", { version: release })}
    </Callout>
  );
}
