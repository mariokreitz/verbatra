import { SiAnthropic, SiDeepl, SiGooglegemini } from "@icons-pack/react-simple-icons";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { OpenAiIcon } from "./openai-icon";
import { SectionHead } from "./section-head";
import { type SwapLogo, SwapLogoCloud } from "./swap-logo-cloud";

const ICON_SIZE = 28;

// Only four providers, which is the exact number of visible slots, so the swap cloud renders
// them statically (with the one-time staggered reveal) rather than inventing fake providers.
const PROVIDERS: ReadonlyArray<SwapLogo> = [
  {
    key: "anthropic",
    name: "Anthropic",
    icon: <SiAnthropic size={ICON_SIZE} color="currentColor" aria-hidden="true" />,
  },
  { key: "openai", name: "OpenAI", icon: <OpenAiIcon size={ICON_SIZE} /> },
  {
    key: "gemini",
    name: "Gemini",
    icon: <SiGooglegemini size={ICON_SIZE} color="currentColor" aria-hidden="true" />,
  },
  {
    key: "deepl",
    name: "DeepL",
    icon: <SiDeepl size={ICON_SIZE} color="currentColor" aria-hidden="true" />,
  },
];

// Server shell: the centered heading renders on the server; the swap cloud is the client leaf.
export async function ProvidersCloud(): Promise<ReactNode> {
  const t = await getTranslations("landing.providers");
  return (
    <section className="mx-auto mt-24 max-w-5xl px-6">
      <SectionHead align="center" maxWidth="620px" title={t("heading")} lead={t("lead")} />
      <div className="mt-12">
        <SwapLogoCloud
          logos={PROVIDERS}
          visibleCount={4}
          label={t("marqueeLabel")}
          gridClassName="grid-cols-2 md:grid-cols-4"
        />
      </div>
    </section>
  );
}
