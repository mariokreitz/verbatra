import { getTranslations } from "next-intl/server";
import { Globe } from "@/components/globe";
import { JsonLd } from "@/components/json-ld";
import {
  Compatibility,
  Eyebrow,
  Faq,
  FinalClose,
  FullFooter,
  GithubIcon,
  HowItWorks,
  PackageInstall,
  SectionHeading,
  TrustStrip,
  WhyUse,
} from "@/components/landing-sections";
import { Showcase } from "@/components/showcase";
import Button from "@/components/ui/button";
import type { Locale } from "@/lib/i18n";
import { type FaqItem, faqPageLd, softwareApplicationLd } from "@/lib/structured-data";

const GITHUB_URL = "https://github.com/mariokreitz/verbatra";

export default async function HomePage(props: { params: Promise<{ lang: string }> }) {
  const { lang } = await props.params;
  const locale = lang as Locale;
  const t = await getTranslations({ locale, namespace: "landing" });

  // FAQ items are read once here (server) and handed to BOTH the visible accordion and the
  // FAQPage JSON-LD, so the two can never drift (the plan's FAQ↔JSON-LD coupling note).
  const faqItems = Object.values(t.raw("faq.items") as Record<string, FaqItem>);

  return (
    <div className="vk-home w-full">
      <JsonLd data={softwareApplicationLd({ description: t("meta.definition"), lang: locale })} />
      <JsonLd data={faqPageLd({ items: faqItems, lang: locale })} />

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6">
        <div className="relative grid items-center gap-9 py-16 md:grid-cols-[1.05fr_0.95fr] md:py-24">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-[8%] -right-[6%] h-[560px] w-[560px] rounded-full"
            style={{ background: "var(--wash-hero)", zIndex: -1 }}
          />
          <div>
            <h1
              className="mb-5 max-w-[14ch] text-5xl font-semibold text-fd-foreground md:text-6xl"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.025em" }}
            >
              {t("hero.headline")}
            </h1>
            <p className="mb-6 max-w-[48ch] text-lg text-fd-muted-foreground">{t("hero.lead")}</p>
            <PackageInstall />
            <div className="mt-6 flex flex-wrap gap-3">
              <Button href="/docs" variant="primary" size="lg" trailingArrow>
                {t("hero.ctaStart")}
              </Button>
              <Button href={GITHUB_URL} variant="secondary" size="lg">
                <GithubIcon size={18} />
                {t("hero.ctaGithub")}
              </Button>
            </div>
          </div>
          <div className="flex justify-center">
            <Globe className="h-auto w-full max-w-[380px]" />
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <TrustStrip />

      {/* Compatibility — the marquee */}
      <Compatibility />

      {/* Showcase */}
      <section className="mx-auto mt-24 max-w-5xl px-6">
        <Eyebrow>{t("showcase.eyebrow")}</Eyebrow>
        <SectionHeading>{t("showcase.heading")}</SectionHeading>
        <p className="mb-8 max-w-[52ch] text-fd-muted-foreground">{t("showcase.body")}</p>
        <Showcase />
      </section>

      {/* How it works */}
      <HowItWorks />

      {/* Why use verbatra */}
      <WhyUse />

      {/* FAQ */}
      <Faq items={faqItems} />

      {/* Final close */}
      <FinalClose />

      {/* Footer */}
      <FullFooter />
    </div>
  );
}
