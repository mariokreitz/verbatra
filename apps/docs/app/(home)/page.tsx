import Link from "next/link";

const GITHUB_URL = "https://github.com/mariokreitz/verbatra";
const LICENSE_URL = `${GITHUB_URL}/blob/main/LICENSE`;

const CONFIG_SNIPPET = `import { defineConfig } from "@verbatra/sdk";

export default defineConfig({
  sourceLocale: "en",
  targetLocales: ["de", "fr"],
  format: "i18next-json",
  files: { pattern: "locales/{locale}.json" },
  provider: {
    id: "anthropic",
    options: { model: "<your-model>", maxTokens: 4096 },
  },
});`;

const VALUE_PROPS: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: "Incremental by default",
    body: "A lock file records what was translated. Each run diffs your source and calls the provider only for the keys that changed.",
  },
  {
    title: "Your choice of provider",
    body: "Anthropic, OpenAI, Gemini, or DeepL, chosen in one line of config. API keys are read from the environment, never the config.",
  },
  {
    title: "Framework-agnostic",
    body: "JSON locale files for i18next, vue-i18n, next-intl, and ngx-translate.",
  },
  {
    title: "Safe by construction",
    body: "Placeholder and ICU integrity are checked after every translation. A result that breaks a placeholder is withheld, and no secret appears in output.",
  },
  {
    title: "CLI and SDK",
    body: "A verbatra command for everyday use, and @verbatra/sdk for scripts, CI, and your own tooling.",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-20 px-6 py-20 md:py-28">
      <section className="flex flex-col items-start gap-6">
        <p className="font-mono text-sm tracking-widest text-fd-muted-foreground">verbatra</p>
        <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight text-fd-foreground md:text-5xl">
          Keep your locale files in sync, automatically.
        </h1>
        <p className="max-w-2xl text-lg text-fd-muted-foreground">
          You maintain the source locale. verbatra translates every other locale through the
          provider you choose, and on each run it sends only the keys that changed.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link
            href="/docs/getting-started"
            className="rounded-md bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
          >
            Get started
          </Link>
          <a
            href={GITHUB_URL}
            className="rounded-md border border-fd-border px-5 py-2.5 text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
          >
            View on GitHub
          </a>
        </div>
      </section>

      <section aria-labelledby="how-heading" className="flex flex-col gap-4">
        <h2 id="how-heading" className="font-mono text-sm tracking-widest text-fd-muted-foreground">
          A config and a command
        </h2>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-fd-border bg-fd-border md:grid-cols-2">
          <div className="flex flex-col gap-3 bg-fd-card p-5">
            <span className="font-mono text-xs text-fd-muted-foreground">verbatra.config.ts</span>
            <pre className="overflow-x-auto text-sm leading-relaxed text-fd-foreground">
              <code className="font-mono">{CONFIG_SNIPPET}</code>
            </pre>
            <div className="mt-1 rounded-md bg-fd-secondary px-3 py-2 font-mono text-sm text-fd-secondary-foreground">
              <span className="text-fd-muted-foreground">$</span> verbatra translate
            </div>
          </div>
          <div className="flex flex-col gap-4 bg-fd-card p-5">
            <span className="font-mono text-xs text-fd-muted-foreground">locales/</span>
            <div className="flex flex-col gap-3 font-mono text-sm">
              <div>
                <div className="text-xs text-fd-muted-foreground">en.json (source)</div>
                <div className="text-fd-foreground">{'{ "cart.checkout": "Checkout" }'}</div>
              </div>
              <div className="text-fd-muted-foreground">
                <span aria-hidden="true">{"↓ "}</span>translated
              </div>
              <div>
                <div className="text-xs text-fd-muted-foreground">de.json</div>
                <div className="text-fd-foreground">
                  {'{ "cart.checkout": '}
                  <span className="text-fd-primary">{'"Zur Kasse"'}</span>
                  {" }"}
                </div>
              </div>
            </div>
            <p className="mt-auto text-sm text-fd-muted-foreground">
              Only the keys that changed since the last run are sent to the provider.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="why-heading" className="flex flex-col gap-8">
        <h2 id="why-heading" className="font-mono text-sm tracking-widest text-fd-muted-foreground">
          Why verbatra
        </h2>
        <ul className="grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2">
          {VALUE_PROPS.map((item) => (
            <li key={item.title} className="flex flex-col gap-2 border-t border-fd-border pt-4">
              <h3 className="font-medium text-fd-foreground">{item.title}</h3>
              <p className="text-sm text-fd-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <footer className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-fd-border pt-6 text-sm text-fd-muted-foreground">
        <span>MIT licensed</span>
        <Link href="/docs" className="transition-colors hover:text-fd-foreground">
          Documentation
        </Link>
        <a href={GITHUB_URL} className="transition-colors hover:text-fd-foreground">
          GitHub
        </a>
        <a href={LICENSE_URL} className="transition-colors hover:text-fd-foreground">
          License
        </a>
      </footer>
    </main>
  );
}
