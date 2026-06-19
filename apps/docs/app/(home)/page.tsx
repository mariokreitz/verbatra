import Link from "next/link";
import { DiffPanel } from "@/components/diff-panel";
import { Globe } from "@/components/globe";
import { CopyCommand } from "@/components/landing";

const GITHUB_URL = "https://github.com/mariokreitz/verbatra";
const LICENSE_URL = `${GITHUB_URL}/blob/main/LICENSE`;
const NPM_CLI = "https://www.npmjs.com/package/@verbatra/cli";
const NPM_SDK = "https://www.npmjs.com/package/@verbatra/sdk";

const FRAMEWORKS = ["Angular", "React", "Vue", "Node.js"];
const PROVIDERS = ["Anthropic", "OpenAI", "Gemini", "DeepL"];

const CAPABILITIES: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: "Incremental by default",
    body: "A committed lock file records what was translated. Each run diffs the source and calls the provider only for the keys that changed.",
  },
  {
    title: "Your choice of provider",
    body: "Anthropic, OpenAI, Gemini, or DeepL, chosen in one line of config. Keys are read from the environment, never the config.",
  },
  {
    title: "Safe by construction",
    body: "Placeholder and ICU integrity are checked after every translation. A result that breaks a placeholder is withheld.",
  },
  {
    title: "CLI and SDK",
    body: "A verbatra command for everyday use, and @verbatra/sdk for scripts, CI, and your own tooling.",
  },
];

function Bullet() {
  return (
    <span
      className="h-1.5 w-1.5 shrink-0 rounded-full"
      style={{ background: "var(--v-glow)", opacity: 0.75 }}
      aria-hidden="true"
    />
  );
}

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 pb-24">
      <section className="relative grid items-center gap-9 py-16 md:grid-cols-[1.05fr_0.95fr] md:py-24">
        <div
          className="pointer-events-none absolute -top-[8%] -right-[6%] -z-10 h-[560px] w-[560px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(156,39,176,0.20), rgba(124,77,255,0.08) 40%, transparent 66%)",
          }}
          aria-hidden="true"
        />
        <div>
          <p className="mb-5 font-mono text-xs tracking-[0.18em] text-fd-muted-foreground">
            open-source i18n automation
          </p>
          <h1
            className="mb-4 max-w-[14ch] text-5xl font-semibold tracking-tight text-fd-foreground md:text-6xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Translate only what changed.
          </h1>
          <p className="mb-6 max-w-[46ch] text-lg text-fd-muted-foreground">
            verbatra is a CLI and SDK that keeps your i18n locale files in sync. You maintain the
            source locale; it fills every other locale through your provider.
          </p>
          <CopyCommand
            command="pnpm add -D @verbatra/cli"
            link={{ token: "@verbatra/cli", href: NPM_CLI }}
          />
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/docs/getting-started" className="v-cta">
              Get started <span aria-hidden="true">&rarr;</span>
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center rounded-[11px] border border-fd-border px-[18px] py-[11px] text-sm font-semibold text-fd-foreground transition-colors hover:bg-fd-accent"
            >
              Read the docs
            </Link>
          </div>
        </div>
        <div className="flex justify-center">
          <Globe className="h-auto w-full max-w-[380px]" />
        </div>
      </section>

      <section aria-labelledby="demo-heading">
        <p
          id="demo-heading"
          className="mb-3 font-mono text-xs uppercase tracking-[0.14em] text-fd-muted-foreground"
        >
          See it work
        </p>
        <DiffPanel />
      </section>

      <section className="my-9 flex flex-col gap-3.5 border-y border-fd-border py-6">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="w-24 font-mono text-[11px] uppercase tracking-[0.12em] text-fd-muted-foreground">
            Works with
          </span>
          {FRAMEWORKS.map((name) => (
            <span key={name} className="inline-flex items-center gap-2 text-fd-foreground">
              <Bullet />
              {name}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="w-24 font-mono text-[11px] uppercase tracking-[0.12em] text-fd-muted-foreground">
            Providers
          </span>
          {PROVIDERS.map((name) => (
            <span key={name} className="inline-flex items-center gap-2 text-fd-foreground">
              <Bullet />
              {name}
            </span>
          ))}
        </div>
      </section>

      <section className="grid gap-x-10 gap-y-6 md:grid-cols-2">
        {CAPABILITIES.map((item) => (
          <div key={item.title} className="border-t border-fd-border pt-3.5">
            <h3
              className="mb-1 font-semibold text-fd-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {item.title}
            </h3>
            <p className="max-w-[44ch] text-sm text-fd-muted-foreground">{item.body}</p>
          </div>
        ))}
      </section>

      <footer className="mt-12 flex flex-wrap items-center gap-5 border-t border-fd-border pt-6 text-sm text-fd-muted-foreground">
        <Link href="/docs" className="transition-colors hover:text-fd-foreground">
          Documentation
        </Link>
        <a href={GITHUB_URL} className="transition-colors hover:text-fd-foreground">
          GitHub
        </a>
        <a href={NPM_CLI} className="transition-colors hover:text-fd-foreground">
          @verbatra/cli
        </a>
        <a href={NPM_SDK} className="transition-colors hover:text-fd-foreground">
          @verbatra/sdk
        </a>
        <a href={LICENSE_URL} className="transition-colors hover:text-fd-foreground">
          MIT license
        </a>
        <span className="ml-auto font-mono text-xs">v0.1.0</span>
      </footer>
    </main>
  );
}
