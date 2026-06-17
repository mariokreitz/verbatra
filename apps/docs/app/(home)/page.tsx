import Link from "next/link";

// Placeholder landing for slice 7a. The real landing (the "why", the preview, the
// feature grid) is built in slice 7b following the frontend-design skill.
export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <h1 className="text-4xl font-bold tracking-tight">verbatra</h1>
      <p className="max-w-2xl text-fd-muted-foreground">
        Automate i18n translation and keep your locale files in sync across languages with AI and
        machine-translation providers.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/docs"
          className="rounded-md bg-fd-primary px-5 py-2.5 font-medium text-fd-primary-foreground"
        >
          Get started
        </Link>
        <a
          href="https://github.com/mariokreitz/verbatra"
          className="rounded-md border px-5 py-2.5 font-medium"
        >
          GitHub
        </a>
      </div>
    </main>
  );
}
