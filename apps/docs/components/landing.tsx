"use client";

import Link from "next/link";
import { useState } from "react";

// Landing pieces for the /docs index hero. The deep brand purple appears only as a
// filled surface (the primary lane), where light text on it clears AA; it is never used
// as text on the dark background, where it would fall below contrast.

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

export function CopyCommand({
  command,
  link,
}: {
  command: string;
  link?: { token: string; href: string };
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable (insecure context); the command is still visible.
    }
  }

  // Optionally turn one token (the package name) into a subtle npm link. Copy still
  // writes the plain command string, and clicking the link does not trigger a copy.
  const tokenAt = link ? command.indexOf(link.token) : -1;

  return (
    <div className="not-prose flex max-w-xl items-center gap-3 rounded-lg border border-fd-border bg-fd-card px-4 py-2.5 font-mono text-sm">
      <span className="text-fd-muted-foreground" aria-hidden="true">
        $
      </span>
      <code className="text-fd-foreground">
        {link && tokenAt >= 0 ? (
          <>
            {command.slice(0, tokenAt)}
            <a
              href={link.href}
              target="_blank"
              rel="noreferrer noopener"
              onClick={(event) => event.stopPropagation()}
              className="rounded underline decoration-fd-border underline-offset-4 transition-colors hover:text-[var(--v-glow)] hover:decoration-[var(--v-glow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--v-purple)]"
            >
              {link.token}
            </a>
            {command.slice(tokenAt + link.token.length)}
          </>
        ) : (
          command
        )}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy install command"
        className="ms-auto rounded-md border border-fd-border px-2 py-1 text-xs text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
      >
        {copied ? "copied" : "copy"}
      </button>
    </div>
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
