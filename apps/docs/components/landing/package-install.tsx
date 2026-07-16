"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { NPM_CLI } from "./links";

const MANAGERS = [
  { id: "pnpm", label: "pnpm", command: "pnpm add -D @verbatra/cli" },
  { id: "npm", label: "npm", command: "npm i -D @verbatra/cli" },
  { id: "yarn", label: "yarn", command: "yarn add -D @verbatra/cli" },
  { id: "bun", label: "bun", command: "bun add -d @verbatra/cli" },
] as const;

const CLI_TOKEN = "@verbatra/cli";
const WINDOW_DOTS = ["#ff5f56", "#ffbd2e", "#27c93f"] as const;

/**
 * The terminal-style install card: package-manager tabs in the title bar, the
 * install command with the @verbatra/cli token linked to npm, and a copy
 * button. Interactive, so it is a client leaf.
 */
export function PackageInstall(): ReactNode {
  const t = useTranslations("landing.install");
  const [active, setActive] = useState<(typeof MANAGERS)[number]["id"]>("pnpm");
  const [copied, setCopied] = useState(false);
  const current = MANAGERS.find((m) => m.id === active) ?? MANAGERS[0];

  async function copy() {
    try {
      await navigator.clipboard.writeText(current.command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  const tokenAt = current.command.indexOf(CLI_TOKEN);

  return (
    <div
      className="not-prose w-full max-w-[28rem] overflow-hidden rounded-2xl border border-fd-border"
      style={{ background: "var(--surface-card)", boxShadow: "var(--shadow-panel)" }}
    >
      <div className="flex items-center gap-3 border-b border-fd-border px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden="true">
          {WINDOW_DOTS.map((color) => (
            <span key={color} className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          ))}
        </span>
        <div role="tablist" aria-label={t("tablistLabel")} className="flex">
          {MANAGERS.map((m) => {
            const selected = m.id === active;
            return (
              <button
                type="button"
                role="tab"
                aria-selected={selected}
                key={m.id}
                onClick={() => setActive(m.id)}
                className={cn(
                  "rounded px-3 py-1.5 font-mono text-xs lowercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                  selected
                    ? "text-fd-foreground"
                    : "text-fd-muted-foreground hover:text-fd-foreground",
                )}
                style={selected ? { boxShadow: "inset 0 -2px 0 var(--v-glow)" } : undefined}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>
      <div
        className="flex items-center gap-3 px-4 py-3 font-mono text-sm"
        style={{ background: "var(--surface-bg)" }}
      >
        <span aria-hidden="true" style={{ color: "var(--v-glow)" }}>
          $
        </span>
        <code className="text-fd-foreground">
          {tokenAt >= 0 ? (
            <>
              {current.command.slice(0, tokenAt)}
              <a
                href={NPM_CLI}
                target="_blank"
                rel="noreferrer noopener"
                onClick={(event) => event.stopPropagation()}
                className="rounded underline decoration-fd-border underline-offset-4 transition-colors hover:text-[var(--accent)] hover:decoration-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                {CLI_TOKEN}
              </a>
              {current.command.slice(tokenAt + CLI_TOKEN.length)}
            </>
          ) : (
            current.command
          )}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label={t("copyAria")}
          className="ms-auto rounded-md border border-fd-border px-2 py-1 text-xs text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          {copied ? t("copied") : t("copy")}
        </button>
      </div>
    </div>
  );
}
