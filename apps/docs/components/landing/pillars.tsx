import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { FeatureCard } from "./feature-card";
import {
  AiTranslationSkeleton,
  AutomationSkeleton,
  ExcelHandoffSkeleton,
} from "./pillar-skeletons";
import { Section } from "./section";
import { SectionHead } from "./section-head";

// verbatra's three core capabilities, reframing it as the whole translation loop rather than
// only AI translation. A single row of three animated feature-block cards (stacks on mobile).
// Server shell: the copy renders on the server; each FeatureCard (beam + sparkles) and its
// skeleton visual is a client leaf. The visuals are decorative; title and body carry meaning.
type Pillar = { key: string; visual: ReactNode };

const PILLARS: ReadonlyArray<Pillar> = [
  { key: "ai", visual: <AiTranslationSkeleton /> },
  { key: "excel", visual: <ExcelHandoffSkeleton /> },
  { key: "automation", visual: <AutomationSkeleton /> },
];

export async function Pillars(): Promise<ReactNode> {
  const t = await getTranslations("landing.pillars");
  return (
    <Section width="lg">
      <SectionHead align="center" maxWidth="620px" title={t("heading")} lead={t("lead")} />
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {PILLARS.map((pillar) => (
          <FeatureCard
            key={pillar.key}
            title={t(`${pillar.key}.title`)}
            body={t(`${pillar.key}.body`)}
            visual={pillar.visual}
          />
        ))}
      </div>
    </Section>
  );
}
