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
import { getSocialStats } from "@/lib/social-stats";
import {
  type FaqItem,
  faqPageLd,
  type HowToStepItem,
  howToLd,
  softwareApplicationLd,
} from "@/lib/structured-data";

const HOW_STEP_KEYS = ["configure", "diff", "translate", "verifyWrite"] as const;

const GITHUB_URL = "https://github.com/mariokreitz/verbatra";

export default async function HomePage(props: { params: Promise<{ lang: string }> }) {
  const { lang } = await props.params;
  const locale = lang as Locale;
  const t = await getTranslations({ locale, namespace: "landing" });

  // FAQ items are read once here (server) and handed to BOTH the visible accordion and the
  // FAQPage JSON-LD, so the two can never drift (the plan's FAQ↔JSON-LD coupling note).
  const faqItems = Object.values(t.raw("faq.items") as Record<string, FaqItem>);

  // The four pipeline steps are read once here (server) so the HowTo JSON-LD stays coupled to
  // the same catalog copy the <HowItWorks> section renders. Order follows HOW_STEP_KEYS.
  const howStepCopy = t.raw("how.steps") as Record<string, { title: string; body: string }>;
  const howSteps: ReadonlyArray<HowToStepItem> = HOW_STEP_KEYS.map((key) => {
    const step = howStepCopy[key];
    return { name: step?.title ?? "", text: step?.body ?? "" };
  });

  // Build-time social-proof stats (GitHub stars, summed npm last-month downloads). Fetched once
  // at build, formatted with the active locale's grouping; null stats are simply not shown.
  const stats = await getSocialStats();
  const numberFormat = new Intl.NumberFormat(locale);
  const formattedStars = stats.stars != null ? numberFormat.format(stats.stars) : null;
  const formattedDownloads = stats.downloads != null ? numberFormat.format(stats.downloads) : null;

  return (
    <div className="vk-home w-full">
      <JsonLd data={softwareApplicationLd({ description: t("meta.definition"), lang: locale })} />
      <JsonLd data={faqPageLd({ items: faqItems, lang: locale })} />
      <JsonLd data={howToLd({ name: t("how.heading"), steps: howSteps, lang: locale })} />

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6">
        <div className="relative grid items-center gap-9 py-16 md:grid-cols-[1.05fr_0.95fr] md:py-24">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-[8%] -right-[6%] h-[560px] w-[560px] rounded-full"
            style={{ background: "var(--wash-hero)", zIndex: -1 }}
          />
          <div>
            {/* Fluid hero size: the clamp floor (2rem) keeps the longest localized headline
                (German "Übersetze nur das, was sich geändert hat.") from clipping or forcing
                horizontal scroll at 360-390px, while the 3.75rem ceiling matches the previous
                desktop text-6xl. Scoped to the hero; the global --text-h1 token is untouched. */}
            <h1
              className="mb-5 max-w-[14ch] font-semibold text-fd-foreground"
              style={{
                fontFamily: "var(--font-display)",
                letterSpacing: "-0.025em",
                fontSize: "clamp(2rem, 8vw + 0.5rem, 3.75rem)",
                lineHeight: 1.05,
              }}
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
      <TrustStrip stars={formattedStars} downloads={formattedDownloads} />

      {/* Compatibility - the marquee */}
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
