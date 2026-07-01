import { SiAnthropic, SiDeepl, SiGooglegemini } from "@icons-pack/react-simple-icons";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Marquee, type MarqueeItem } from "./fx/marquee";
import { LogoTile } from "./logo-tile";
import { OpenAiIcon } from "./openai-icon";
import { SectionHead } from "./section-head";

// The four translation providers. Icons use currentColor so the shared tile tints them; the
// tiles are non-interactive logos (a moving link target is poor UX, and the providers doc is
// linked elsewhere).
type Provider = { name: string; kind: string; icon: ReactNode };

const PROVIDERS: ReadonlyArray<Provider> = [
  {
    name: "Anthropic",
    kind: "LLM",
    icon: <SiAnthropic size={24} color="currentColor" aria-hidden="true" />,
  },
  { name: "OpenAI", kind: "LLM", icon: <OpenAiIcon size={24} /> },
  {
    name: "Gemini",
    kind: "LLM",
    icon: <SiGooglegemini size={24} color="currentColor" aria-hidden="true" />,
  },
  {
    name: "DeepL",
    kind: "machine translation",
    icon: <SiDeepl size={24} color="currentColor" aria-hidden="true" />,
  },
];

const PROVIDER_ITEMS: ReadonlyArray<MarqueeItem> = PROVIDERS.map((provider) => ({
  key: provider.name,
  label: `${provider.name} (${provider.kind})`,
  node: <LogoTile icon={provider.icon} name={provider.name} sub={provider.kind} />,
}));

// Providers logo-cloud marquee: matches the frameworks strip but scrolls the other way. Only
// four providers, so the track is repeated to fill the band with no gap. Server component
// (the marquee is pure CSS).
export async function ProvidersMarquee(): Promise<ReactNode> {
  const t = await getTranslations("landing.providers");
  return (
    <section className="mt-24">
      <div className="mx-auto max-w-5xl px-6">
        <SectionHead
          align="center"
          maxWidth="620px"
          eyebrow={t("eyebrow")}
          title={t("heading")}
          lead={t("lead")}
        />
      </div>
      <div className="mt-12">
        <Marquee
          items={PROVIDER_ITEMS}
          direction="right"
          duration={32}
          repeat={2}
          label={t("marqueeLabel")}
          maxWidth="48rem"
        />
      </div>
    </section>
  );
}
