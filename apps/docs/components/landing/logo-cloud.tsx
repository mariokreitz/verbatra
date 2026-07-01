"use client";

import { SiAnthropic, SiDeepl, SiGooglegemini } from "@icons-pack/react-simple-icons";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { OpenAiIcon } from "./openai-icon";
import { SectionHead } from "./section-head";

const ICON_CLASS = "text-[color:var(--accent)]";

// Each tile links to its section on the providers doc, so the tiles are genuinely
// interactive (focusable, keyboard-reachable) and the reveal can mirror across hover and
// focus without a non-interactive tabindex. Icons are decorative; the link text names the
// provider.
type Provider = { name: string; kind: string; href: string; icon: ReactNode };

const PROVIDERS: ReadonlyArray<Provider> = [
  {
    name: "Anthropic",
    kind: "LLM",
    href: "/docs/providers#anthropic",
    icon: <SiAnthropic size={30} color="currentColor" aria-hidden="true" className={ICON_CLASS} />,
  },
  {
    name: "OpenAI",
    kind: "LLM",
    href: "/docs/providers#openai",
    icon: <OpenAiIcon size={30} className={ICON_CLASS} />,
  },
  {
    name: "Gemini",
    kind: "LLM",
    href: "/docs/providers#gemini",
    icon: (
      <SiGooglegemini size={30} color="currentColor" aria-hidden="true" className={ICON_CLASS} />
    ),
  },
  {
    name: "DeepL",
    kind: "machine translation",
    href: "/docs/providers#deepl",
    icon: <SiDeepl size={30} color="currentColor" aria-hidden="true" className={ICON_CLASS} />,
  },
];

const MotionLink = motion.create(Link);

// Blur-flip provider logo cloud. Tiles rest dimmed, blurred, and desaturated; on hover or
// keyboard focus they sharpen, lift, and gain the brand glow border. Under reduced motion
// the same detection used elsewhere (prefers-reduced-motion) renders the sharp state with no
// transform or transition.
export function LogoCloud(): ReactNode {
  const t = useTranslations("landing.providers");
  const reduced = useReducedMotion();

  // The "revealed" look; under reduced motion it is also the resting (static) look.
  const revealed = { opacity: 1, filter: "blur(0px) grayscale(0)", y: 0 };
  const dimmed = { opacity: 0.5, filter: "blur(1.5px) grayscale(1)", y: 0 };
  const lifted = { opacity: 1, filter: "blur(0px) grayscale(0)", y: -4 };

  return (
    <section className="mx-auto mt-24 max-w-5xl px-6">
      <SectionHead
        align="center"
        maxWidth="620px"
        eyebrow={t("eyebrow")}
        title={t("heading")}
        lead={t("lead")}
      />
      <ul className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4">
        {PROVIDERS.map((provider) => (
          <li key={provider.name}>
            <MotionLink
              href={provider.href}
              className="flex flex-col items-center justify-center gap-2.5 rounded-xl border border-fd-border p-6 text-center transition-[border-color,box-shadow] hover:border-[color:color-mix(in_srgb,var(--v-glow)_40%,var(--border-default))] focus-visible:border-[color:color-mix(in_srgb,var(--v-glow)_40%,var(--border-default))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-fd-background motion-reduce:transition-none"
              style={{ background: "var(--surface-card)" }}
              initial={false}
              animate={reduced ? revealed : dimmed}
              whileHover={reduced ? undefined : lifted}
              whileFocus={reduced ? undefined : lifted}
              transition={reduced ? { duration: 0 } : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              {provider.icon}
              <span
                className="text-[0.98rem] font-medium text-fd-foreground"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {provider.name}
              </span>
              <span className="font-mono text-[11px] text-[color:var(--text-faint)]">
                {provider.kind}
              </span>
            </MotionLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
