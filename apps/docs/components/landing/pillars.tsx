import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { SpotlightCard } from "./fx/spotlight-card";
import {
  AiTranslationSkeleton,
  AutomationSkeleton,
  ExcelHandoffSkeleton,
} from "./pillar-skeletons";
import { Section } from "./section";
import { SectionHead } from "./section-head";

// verbatra's three core capabilities, reframing it as the whole translation loop rather than
// only AI translation. A single row of three equal cards (stacks on mobile). Server shell:
// the copy renders on the server; each SpotlightCard and its animated skeleton is a client
// leaf. The skeletons are decorative (aria-hidden); the title and body carry the meaning.
type Pillar = { key: string; Skeleton: () => ReactNode };

const PILLARS: ReadonlyArray<Pillar> = [
  { key: "ai", Skeleton: AiTranslationSkeleton },
  { key: "excel", Skeleton: ExcelHandoffSkeleton },
  { key: "automation", Skeleton: AutomationSkeleton },
];

export async function Pillars(): Promise<ReactNode> {
  const t = await getTranslations("landing.pillars");
  return (
    <Section width="lg">
      <SectionHead align="center" maxWidth="620px" title={t("heading")} lead={t("lead")} />
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {PILLARS.map((pillar) => {
          const Skeleton = pillar.Skeleton;
          return (
            <SpotlightCard key={pillar.key} style={{ padding: 0 }}>
              <div className="flex h-full flex-col gap-4 p-6">
                <div>
                  <h3
                    className="mb-2 text-[1.18rem] font-semibold text-fd-foreground"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {t(`${pillar.key}.title`)}
                  </h3>
                  <p className="text-sm leading-relaxed text-fd-muted-foreground">
                    {t(`${pillar.key}.body`)}
                  </p>
                </div>
                <div className="mt-auto pt-2" aria-hidden="true">
                  <Skeleton />
                </div>
              </div>
            </SpotlightCard>
          );
        })}
      </div>
    </Section>
  );
}
