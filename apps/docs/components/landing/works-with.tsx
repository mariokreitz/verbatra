import {
  type IconType,
  SiAngular,
  SiNextdotjs,
  SiNodedotjs,
  SiNuxt,
  SiReact,
  SiVuedotjs,
} from "@icons-pack/react-simple-icons";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Marquee, type MarqueeItem } from "./fx/marquee";
import { SectionHead } from "./section-head";

type Chip = { name: string; sub: string };

// Frameworks and the JSON locale formats they use. Providers have their own logo cloud
// section now, so this marquee is frameworks-only.
const FRAMEWORK_CHIPS: ReadonlyArray<Chip> = [
  { name: "React", sub: "next-intl" },
  { name: "Next.js", sub: "next-intl" },
  { name: "Vue", sub: "vue-i18n" },
  { name: "Nuxt", sub: "vue-i18n" },
  { name: "Angular", sub: "ngx-translate" },
  { name: "Node.js", sub: "i18next" },
  { name: "i18next", sub: "json" },
  { name: "next-intl", sub: "json" },
  { name: "vue-i18n", sub: "json" },
  { name: "ngx-translate", sub: "json" },
];

const CHIP_ICONS: Readonly<Record<string, IconType>> = {
  React: SiReact,
  "Next.js": SiNextdotjs,
  Vue: SiVuedotjs,
  Nuxt: SiNuxt,
  Angular: SiAngular,
  "Node.js": SiNodedotjs,
};

// GlyphTile look: a hairline rounded tile carrying the real brand icon (or a glow dot for
// the format chips), the name in the display face, and the format in mono. The translucent
// card surface keeps the marquee reading as light glyphs gliding over the grid.
function MarqueeChip({ chip }: { chip: Chip }): ReactNode {
  const Icon = CHIP_ICONS[chip.name];
  return (
    <span
      className="mx-1.5 inline-flex h-11 min-w-[12.5rem] items-center justify-center gap-2.5 whitespace-nowrap rounded-[10px] border border-fd-border px-4"
      style={{ background: "color-mix(in srgb, var(--surface-card) 70%, transparent)" }}
    >
      {Icon ? (
        <Icon
          size={16}
          color="currentColor"
          aria-hidden="true"
          className="shrink-0 text-[color:var(--accent)]"
        />
      ) : (
        <span
          aria-hidden="true"
          className="inline-block h-[7px] w-[7px] shrink-0 rounded-full"
          style={{ background: "var(--v-glow)", boxShadow: "var(--glow-mark)" }}
        />
      )}
      <span
        className="text-[0.98rem] font-medium text-fd-foreground"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {chip.name}
      </span>
      <span className="font-mono text-[11px] text-[color:var(--text-faint)]">{chip.sub}</span>
    </span>
  );
}

const FRAMEWORK_ITEMS: ReadonlyArray<MarqueeItem> = FRAMEWORK_CHIPS.map((chip) => ({
  key: chip.name,
  label: `${chip.name} (${chip.sub})`,
  node: <MarqueeChip chip={chip} />,
}));

export async function WorksWith(): Promise<ReactNode> {
  const t = await getTranslations("landing.compat");
  return (
    <section className="mt-24">
      <div className="mx-auto max-w-5xl px-6">
        <SectionHead eyebrow={t("eyebrow")} title={t("heading")} lead={t("body")} />
      </div>
      <div className="mt-12">
        <Marquee
          items={FRAMEWORK_ITEMS}
          direction="left"
          duration={35}
          label={t("labelFrameworks")}
          maxWidth="48rem"
        />
      </div>
    </section>
  );
}
