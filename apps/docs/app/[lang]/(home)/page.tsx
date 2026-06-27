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
import { PACKAGE_VERSION } from "@/lib/site";
import { getLatestVersion, getSocialStats } from "@/lib/social-stats";
import {
  type FaqItem,
  faqPageLd,
  type HowToStepItem,
  howToLd,
  softwareApplicationLd,
} from "@/lib/structured-data";

// Must be a static literal, so it mirrors REVALIDATE_SECONDS (24h) in lib/social-stats; the two must stay in sync.
export const revalidate = 86_400;

const HOW_STEP_KEYS = ["configure", "diff", "translate", "verifyWrite"] as const;

const GITHUB_URL = "https://github.com/mariokreitz/verbatra";

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

  const [stats, latestVersion] = await Promise.all([getSocialStats(), getLatestVersion()]);
  const version = latestVersion ?? PACKAGE_VERSION;
  const numberFormat = new Intl.NumberFormat(locale);
  const formattedStars = stats.stars != null ? numberFormat.format(stats.stars) : null;
  const formattedDownloads = stats.downloads != null ? numberFormat.format(stats.downloads) : null;

  return (
    <div className="vk-home w-full">
      <JsonLd
        data={softwareApplicationLd({ description: t("meta.definition"), lang: locale, version })}
      />
      <JsonLd data={faqPageLd({ items: faqItems, lang: locale })} />
      <JsonLd data={howToLd({ name: t("how.heading"), steps: howSteps, lang: locale })} />

      <section className="mx-auto max-w-5xl px-6">
        <div className="relative grid items-center gap-9 py-16 md:grid-cols-[1.05fr_0.95fr] md:py-24">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-[8%] -right-[6%] h-[560px] w-[560px] rounded-full"
            style={{ background: "var(--wash-hero)", zIndex: -1 }}
          />
          <div>
            {/* Clamp floor (2rem) keeps the longest localized headline (German) from clipping at 360-390px; the 3.75rem ceiling matches the desktop size. */}
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

      <TrustStrip version={version} stars={formattedStars} downloads={formattedDownloads} />

      <Compatibility />

      <section className="mx-auto mt-24 max-w-5xl px-6">
        <Eyebrow>{t("showcase.eyebrow")}</Eyebrow>
        <SectionHeading>{t("showcase.heading")}</SectionHeading>
        <p className="mb-8 max-w-[52ch] text-fd-muted-foreground">{t("showcase.body")}</p>
        <Showcase />
      </section>

      <HowItWorks />

      <WhyUse />

      <Faq items={faqItems} />

      <FinalClose />

      <FullFooter />
    </div>
  );
}
