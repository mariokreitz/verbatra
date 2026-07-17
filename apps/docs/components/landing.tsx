import Link from "next/link";

export function VMark({ size = 44 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-label="verbatra"
      style={{
        filter: "drop-shadow(0 0 6px color-mix(in srgb, var(--v-glow) 60%, transparent))",
      }}
    >
      <path
        d="M4 4 L12 20 L20 4"
        stroke="var(--v-glow)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Lane = {
  href: string;
  tag: string;
  label: string;
  primary?: boolean;
};

const LANES: ReadonlyArray<Lane> = [
  { href: "/docs", tag: "New here", label: "Start in 5 minutes", primary: true },
  { href: "/docs/add-a-language", tag: "Already installed", label: "Add a language" },
  { href: "/docs/ci-and-exit-codes", tag: "Going to prod", label: "Wire up CI" },
];

export function LaneCards() {
  return (
    <div className="not-prose my-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {LANES.map((lane) =>
        lane.primary ? (
          <Link
            key={lane.href}
            href={lane.href}
            className="group flex flex-col gap-2 rounded-xl p-4 transition-[filter] hover:brightness-110"
            style={{ background: "var(--v-purple)", color: "hsl(290 60% 98%)" }}
          >
            <span className="font-mono text-xs tracking-wide" style={{ color: "hsl(290 60% 92%)" }}>
              {lane.tag}
            </span>
            <span className="flex items-center gap-1 font-medium">
              {lane.label}
              <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </span>
          </Link>
        ) : (
          <Link
            key={lane.href}
            href={lane.href}
            className="group flex flex-col gap-2 rounded-xl border border-fd-border bg-fd-card p-4 transition-colors hover:bg-fd-accent"
          >
            <span className="font-mono text-xs tracking-wide text-fd-muted-foreground">
              {lane.tag}
            </span>
            <span className="flex items-center gap-1 font-medium text-fd-foreground">
              {lane.label}
              <span
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-0.5"
                style={{ color: "var(--v-glow)" }}
              >
                →
              </span>
            </span>
          </Link>
        ),
      )}
    </div>
  );
}

const REFERENCES: ReadonlyArray<[label: string, href: string]> = [
  ["config", "/docs/config-file"],
  ["providers", "/docs/providers"],
  ["cli", "/docs/cli"],
  ["sdk", "/docs/sdk"],
  ["action", "/docs/github-action"],
];

export function ReferenceRow() {
  return (
    <div className="not-prose flex flex-wrap items-center gap-y-2 font-mono text-sm text-fd-muted-foreground">
      <span className="me-2">Reference:</span>
      {REFERENCES.map(([label, href], i) => (
        <span key={href} className="flex items-center">
          <Link
            href={href}
            className="underline-offset-4 transition-colors hover:text-fd-foreground hover:underline"
          >
            {label}
          </Link>
          {i < REFERENCES.length - 1 ? (
            <span className="px-2 text-fd-border" aria-hidden="true">
              ·
            </span>
          ) : null}
        </span>
      ))}
    </div>
  );
}
