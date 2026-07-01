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
import { LogoTile } from "./logo-tile";
import { SectionHead } from "./section-head";

type Chip = { name: string; sub: string };

// Frameworks and the JSON locale formats they use. Providers have their own marquee now.
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

// The real brand icon (currentColor, tinted by the tile), or a glow dot for the format-only
// chips that have no logo.
function chipIcon(name: string): ReactNode {
  const Icon = CHIP_ICONS[name];
  if (Icon) return <Icon size={24} color="currentColor" aria-hidden="true" />;
  return (
    <span
      aria-hidden="true"
      className="inline-block h-[7px] w-[7px] rounded-full"
      style={{ background: "var(--v-glow)", boxShadow: "var(--glow-mark)" }}
    />
  );
}

const FRAMEWORK_ITEMS: ReadonlyArray<MarqueeItem> = FRAMEWORK_CHIPS.map((chip) => ({
  key: chip.name,
  label: `${chip.name} (${chip.sub})`,
  node: <LogoTile icon={chipIcon(chip.name)} name={chip.name} sub={chip.sub} />,
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
          duration={40}
          label={t("labelFrameworks")}
          maxWidth="48rem"
        />
      </div>
    </section>
  );
}
