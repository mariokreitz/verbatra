import { getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/json-ld";
import { Faq } from "@/components/landing/faq";
import { Features } from "@/components/landing/features";
import { FinalCta } from "@/components/landing/final-cta";
import { FullFooter } from "@/components/landing/footer";
import { FrameworksCloud } from "@/components/landing/frameworks-cloud";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Pillars } from "@/components/landing/pillars";
import { ProvidersCloud } from "@/components/landing/providers-cloud";
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

  const faqItems = Object.values(t.raw("faq.items") as Record<string, FaqItem>);

  const howStepCopy = t.raw("how.steps") as Record<string, { title: string; body: string }>;
  const howSteps: ReadonlyArray<HowToStepItem> = HOW_STEP_KEYS.map((key) => {
    const step = howStepCopy[key];
    return { name: step?.title ?? "", text: step?.body ?? "" };
  });

  const version = PACKAGE_VERSION;

  return (
    <div className="vk-home w-full">
      <JsonLd
        data={softwareApplicationLd({ description: t("meta.definition"), lang: locale, version })}
      />
      <JsonLd data={faqPageLd({ items: faqItems, lang: locale })} />
      <JsonLd data={howToLd({ name: t("how.heading"), steps: howSteps, lang: locale })} />

      <LandingHero />
      <Pillars />
      <FrameworksCloud />
      <ProvidersCloud />
      <HowItWorks />
      <Features />
      <Faq items={faqItems} />
      <FinalCta />
      <FullFooter />
    </div>
  );
}
