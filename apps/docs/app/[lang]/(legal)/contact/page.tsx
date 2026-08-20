import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ContactForm } from "@/components/contact-form";
import { toLocale } from "@/lib/i18n";
import { localeAlternates } from "@/lib/site";

export async function generateMetadata(props: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await props.params;
  const locale = toLocale(lang);
  const t = await getTranslations({ locale, namespace: "legal.contact.meta" });
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: true },
    alternates: localeAlternates(locale, "/contact"),
  };
}

export default async function ContactPage(props: { params: Promise<{ lang: string }> }) {
  const { lang } = await props.params;
  const t = await getTranslations({ locale: lang, namespace: "legal.contact" });

  return (
    <main className="container mx-auto max-w-3xl px-6 py-16 prose">
      <h1>{t("title")}</h1>
      <p>{t("intro")}</p>
      <ContactForm />
    </main>
  );
}
