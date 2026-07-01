import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { SpotlightCard } from "./fx/spotlight-card";
import { Section } from "./section";
import { SectionHead } from "./section-head";

type Reason = { title: string; body: string };
type FeatureAccent = "diff" | "cmd";

// Bento spans over the 3-column grid: 2,1 / 1,1,1 / 3. That tiles into three full rows
// with no empty trailing cell. The first card (diff accent) leads at width 2; the last
// card (cmd accent) closes as a full-width banner. The accents keep both wide cards
// prominent. (Spans apply only at the lg 3-column grid; at sm the six cards tile 2-up,
// and at the base width they stack: every breakpoint stays fully filled.)
const FEATURE_SPANS = [2, 1, 1, 1, 1, 3] as const;
const FEATURE_ACCENTS: Readonly<Record<number, FeatureAccent>> = { 0: "diff", 5: "cmd" };
const FEATURE_SPAN_CLASS: Readonly<Record<number, string>> = {
  2: "lg:col-span-2",
  3: "lg:col-span-3",
};

const CMD_CHIPS = ["$ verbatra translate --dry-run", "$ verbatra watch"] as const;

function DiffAccent(): ReactNode {
  return (
    <div
      className="mt-5 rounded-lg px-3.5 py-3 font-mono text-[12.5px] leading-relaxed"
      style={{
        background: "var(--surface-bg)",
        borderInlineStart: "2px solid var(--v-glow)",
      }}
    >
      <div>
        <span style={{ color: "var(--v-glow)" }}>+ </span>
        <span className="text-fd-muted-foreground">&quot;cart.checkout&quot;:</span>{" "}
        <span style={{ color: "var(--v-glow)" }}>&quot;Jetzt bezahlen&quot;</span>{" "}
        <span style={{ color: "var(--v-pink)" }}>changed</span>
      </div>
      <div style={{ opacity: 0.55 }}>
        <span className="text-fd-muted-foreground">. &quot;cart.total&quot;:</span>{" "}
        <span className="text-fd-foreground">&quot;Gesamt&quot;</span> unchanged
      </div>
      <div style={{ opacity: 0.55 }}>
        <span className="text-fd-muted-foreground">. &quot;nav.home&quot;:</span>{" "}
        <span className="text-fd-foreground">&quot;Startseite&quot;</span> unchanged
      </div>
    </div>
  );
}

function CmdAccent({ className }: { className?: string }): ReactNode {
  return (
    <div className={`flex flex-wrap gap-2.5 ${className ?? ""}`}>
      {CMD_CHIPS.map((cmd) => (
        <span
          key={cmd}
          className="rounded-md border border-fd-border px-3 py-1.5 font-mono text-[12.5px]"
          style={{ background: "var(--surface-bg)" }}
        >
          <span style={{ color: "var(--v-glow)" }}>$</span>
          {cmd.slice(1)}
        </span>
      ))}
    </div>
  );
}

// Server shell: the grid and copy render on the server; only each SpotlightCard (cursor
// glow) is a client leaf.
export async function Features(): Promise<ReactNode> {
  const t = await getTranslations("landing.why");
  const reasons = Object.values(t.raw("reasons") as Record<string, Reason>);
  return (
    <Section width="lg">
      <SectionHead title={t("heading")} lead={t("lead")} />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reasons.map((reason, i) => {
          const accent = FEATURE_ACCENTS[i];
          const span = FEATURE_SPANS[i] ?? 1;
          // The full-width closing card lays its copy and command chips side by side on wide
          // viewports so the banner fills its row instead of stranding empty space.
          const banner = span === 3;
          return (
            <SpotlightCard
              key={reason.title}
              className={FEATURE_SPAN_CLASS[span] ?? ""}
              style={{ padding: "1.6rem 1.7rem" }}
            >
              {banner ? (
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-8">
                  <div className="md:max-w-md">
                    <h3
                      className="mb-2 text-[1.18rem] font-semibold text-fd-foreground"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {reason.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-fd-muted-foreground">
                      {reason.body}
                    </p>
                  </div>
                  <CmdAccent className="shrink-0" />
                </div>
              ) : (
                <>
                  <h3
                    className="mb-2 text-[1.18rem] font-semibold text-fd-foreground"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {reason.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-fd-muted-foreground">{reason.body}</p>
                  {accent === "diff" ? <DiffAccent /> : null}
                </>
              )}
            </SpotlightCard>
          );
        })}
      </div>
    </Section>
  );
}
