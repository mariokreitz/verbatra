import { Globe } from "@/components/globe";
import { JsonLd } from "@/components/json-ld";
import {
  Compatibility,
  Eyebrow,
  Faq,
  FinalClose,
  FullFooter,
  GithubIcon,
  HowItWorks,
  PackageInstall,
  SectionHeading,
  WhyUse,
} from "@/components/landing-sections";
import { Showcase } from "@/components/showcase";
import Button from "@/components/ui/button";
import { FAQ_ITEMS, faqPageLd, softwareApplicationLd } from "@/lib/structured-data";

const GITHUB_URL = "https://github.com/mariokreitz/verbatra";

const TRUST_ITEMS = [
  "MIT licensed",
  "Incremental",
  "Placeholder-safe",
  "CLI + SDK",
  "CI-ready",
] as const;

export default function HomePage() {
  return (
    <div className="vk-home w-full">
      <JsonLd data={softwareApplicationLd()} />
      <JsonLd data={faqPageLd(FAQ_ITEMS)} />

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6">
        <div className="relative grid items-center gap-9 py-16 md:grid-cols-[1.05fr_0.95fr] md:py-24">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-[8%] -right-[6%] h-[560px] w-[560px] rounded-full"
            style={{ background: "var(--wash-hero)", zIndex: -1 }}
          />
          <div>
            <h1
              className="mb-5 max-w-[14ch] text-5xl font-semibold text-fd-foreground md:text-6xl"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.025em" }}
            >
              Translate only what changed.
            </h1>
            <p className="mb-6 max-w-[48ch] text-lg text-fd-muted-foreground">
              verbatra is a CLI and SDK that keeps your i18n locale files in sync. You maintain the
              source locale; it fills every other locale through the AI provider you choose.
            </p>
            <PackageInstall />
            <div className="mt-6 flex flex-wrap gap-3">
              <Button href="/docs" variant="primary" size="lg" trailingArrow>
                Start now
              </Button>
              <Button href={GITHUB_URL} variant="secondary" size="lg">
                <GithubIcon size={18} />
                Star on GitHub
              </Button>
            </div>
          </div>
          <div className="flex justify-center">
            <Globe className="h-auto w-full max-w-[380px]" />
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="mx-auto max-w-5xl px-6">
        <div className="border-y border-fd-border py-5">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-[color:var(--accent)]">
            Trusted building blocks
          </p>
          <ul className="flex flex-wrap items-center gap-x-8 gap-y-3">
            {TRUST_ITEMS.map((item) => (
              <li
                key={item}
                className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-fd-muted-foreground"
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: "var(--v-glow)", boxShadow: "var(--glow-mark)" }}
                />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Compatibility — the marquee */}
      <Compatibility />

      {/* Showcase */}
      <section className="mx-auto mt-24 max-w-5xl px-6">
        <Eyebrow>see a run unfold</Eyebrow>
        <SectionHeading>Watch it touch exactly one key.</SectionHeading>
        <p className="mb-8 max-w-[52ch] text-fd-muted-foreground">
          A first run fills the new keys; change one source value and the next run sends only that
          key. Everything else is left untouched.
        </p>
        <Showcase />
      </section>

      {/* How it works */}
      <HowItWorks />

      {/* Why use verbatra */}
      <WhyUse />

      {/* FAQ */}
      <Faq />

      {/* Final close */}
      <FinalClose />

      {/* Footer */}
      <FullFooter />
    </div>
  );
}
