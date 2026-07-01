import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import Button from "@/components/ui/button";
import { Backdrop } from "./fx/backdrop";
import { GithubIcon } from "./github-icon";
import { GITHUB_URL } from "./links";
import { SectionHead } from "./section-head";

// Server shell: the heading, lead, and CTAs render on the server; only the decorative
// Backdrop (grid/beams/sparkles) is a client leaf.
export async function FinalCta(): Promise<ReactNode> {
  const t = await getTranslations("landing.finalClose");
  const tHero = await getTranslations("landing.hero");
  return (
    <section
      className="relative mt-24 overflow-hidden border-t border-fd-border"
      style={{ paddingBlock: "6rem" }}
    >
      <Backdrop
        gridFade="radial-gradient(ellipse 60% 90% at 50% 50%, #000 30%, transparent 75%)"
        beams={false}
        spotlightFill="var(--v-purple)"
        sparkleDensity={0.00012}
      />
      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <SectionHead align="center" maxWidth="640px" title={t("heading")} lead={t("lead")} />
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button href="/docs/your-first-translation" variant="primary" size="lg" trailingArrow>
            {tHero("ctaQuickstart")}
          </Button>
          <Button href={GITHUB_URL} variant="secondary" size="lg">
            <GithubIcon size={18} />
            {tHero("ctaGithub")}
          </Button>
        </div>
      </div>
    </section>
  );
}
