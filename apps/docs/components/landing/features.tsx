import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import {
  DryRunSkeleton,
  EnvSkeleton,
  IncrementalSkeleton,
  OneEngineSkeleton,
  ProviderSkeleton,
  SafetySkeleton,
} from "./feature-skeletons";
import { SpotlightCard } from "./fx/spotlight-card";
import { Section } from "./section";
import { SectionHead } from "./section-head";

type Reason = { title: string; body: string };
type Cell = { key: string; span: string; Skeleton: () => ReactNode };

// Bento over the 3-column lg grid, in DOM order so auto-placement tiles it into three rows:
//   A incremental (col 2) | B provider (col 1, tall row-span 2)
//   C safety | D environment            (B continues)
//   E oneEngine (col 2)  | F dryRun
// Spans apply only at lg; at sm the six cells tile 2-up, at base they stack, every cell filled.
const CELLS: ReadonlyArray<Cell> = [
  { key: "incremental", span: "lg:col-span-2", Skeleton: IncrementalSkeleton },
  { key: "provider", span: "lg:row-span-2", Skeleton: ProviderSkeleton },
  { key: "safety", span: "", Skeleton: SafetySkeleton },
  { key: "environment", span: "", Skeleton: EnvSkeleton },
  { key: "oneEngine", span: "lg:col-span-2", Skeleton: OneEngineSkeleton },
  { key: "dryRun", span: "", Skeleton: DryRunSkeleton },
];

// Server shell: the grid and copy render on the server; each SpotlightCard (cursor glow) and
// the animated skeletons are client leaves. The skeletons are decorative (aria-hidden); the
// title and body carry the accessible meaning.
export async function Features(): Promise<ReactNode> {
  const t = await getTranslations("landing.why");
  const reasons = t.raw("reasons") as Record<string, Reason>;
  return (
    <Section width="lg">
      <SectionHead title={t("heading")} lead={t("lead")} />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CELLS.map((cell) => {
          const reason = reasons[cell.key];
          if (!reason) return null;
          const Skeleton = cell.Skeleton;
          return (
            <SpotlightCard key={cell.key} className={cell.span} style={{ padding: 0 }}>
              <div className="flex h-full flex-col gap-4 p-6">
                <div>
                  <h3
                    className="mb-2 text-[1.18rem] font-semibold text-fd-foreground"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {reason.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-fd-muted-foreground">{reason.body}</p>
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
