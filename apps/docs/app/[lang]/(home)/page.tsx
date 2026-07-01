import { getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/json-ld";
import { Faq } from "@/components/landing/faq";
import { Features } from "@/components/landing/features";
import { FinalCta } from "@/components/landing/final-cta";
import { FullFooter } from "@/components/landing/footer";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LogoCloud } from "@/components/landing/logo-cloud";
import { WorksWith } from "@/components/landing/works-with";
import { LandingHero } from "@/components/landing-hero";
import type { Locale } from "@/lib/i18n";
import { PACKAGE_VERSION } from "@/lib/site";
import {
  type FaqItem,
  faqPageLd,
  type HowToStepItem,
  howToLd,
  softwareApplicationLd,
} from "@/lib/structured-data";

const HOW_STEP_KEYS = ["configure", "diff", "translate", "verifyWrite"] as const;

export default async function HomePage(props: { params: Promise<{ lang: string }> }) {
  const { lang } = await props.params;
  const locale = lang as Locale;
  const t = await getTranslations({ locale, namespace: "landing" });

  // Shared with the FAQPage JSON-LD so the visible accordion and structured data cannot drift.
  const faqItems = Object.values(t.raw("faq.items") as Record<string, FaqItem>);

  // Shared with the HowTo JSON-LD so it stays coupled to the same copy <HowItWorks> renders.
  const howStepCopy = t.raw("how.steps") as Record<string, { title: string; body: string }>;
  const howSteps: ReadonlyArray<HowToStepItem> = HOW_STEP_KEYS.map((key) => {
    const step = howStepCopy[key];
    return { name: step?.title ?? "", text: step?.body ?? "" };
  });

  // The displayed status badges are live external images; the build-time version only feeds the JSON-LD.
  const version = PACKAGE_VERSION;

  return (
    <div className="vk-home w-full">
      <JsonLd
        data={softwareApplicationLd({ description: t("meta.definition"), lang: locale, version })}
      />
      <JsonLd data={faqPageLd({ items: faqItems, lang: locale })} />
      <JsonLd data={howToLd({ name: t("how.heading"), steps: howSteps, lang: locale })} />

      <LandingHero />
      <WorksWith />
      <LogoCloud />
      <HowItWorks />
      <Features />
      <Faq items={faqItems} />
      <FinalCta />
      <FullFooter />
    </div>
  );
}
