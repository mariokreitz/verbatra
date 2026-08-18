"use client";

import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { HighlightedCommand } from "@/components/ui/command-line";
import { TabList } from "@/components/ui/tabs";
import { AI_SETUP_PROMPT } from "@/lib/ai-setup-prompt";
import { type Locale, localizedPath } from "@/lib/i18n";
import { useCopyToClipboard } from "@/lib/use-copy-to-clipboard";
import { cn } from "@/lib/utils";
import { NPM_CLI } from "./links";

const MANAGERS = [
  { id: "npm", label: "npm", command: "npm i -D @verbatra/cli" },
  { id: "pnpm", label: "pnpm", command: "pnpm add -D @verbatra/cli" },
  { id: "yarn", label: "yarn", command: "yarn add -D @verbatra/cli" },
  { id: "bun", label: "bun", command: "bun add -d @verbatra/cli" },
] as const;

const AI_TAB_ID = "ai" as const;
type ActiveTab = (typeof MANAGERS)[number]["id"] | typeof AI_TAB_ID;

const CLI_TOKEN = "@verbatra/cli";
const WINDOW_DOTS = ["#ff5f56", "#ffbd2e", "#27c93f"] as const;
const TAB_CLASS =
  "rounded px-3 py-1.5 font-mono text-xs lowercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";

export function PackageInstall(): ReactNode {
  const t = useTranslations("landing.install");
  const locale = useLocale() as Locale;
  const [active, setActive] = useState<ActiveTab>("npm");
  const [copied, copy] = useCopyToClipboard();
  const isAiTab = active === AI_TAB_ID;
  const manager = MANAGERS.find((m) => m.id === active) ?? MANAGERS[0];
  const commandText = isAiTab ? AI_SETUP_PROMPT : manager.command;

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
        <TabList
          tabs={MANAGERS}
          active={active}
          onSelect={(id) => setActive(id as (typeof MANAGERS)[number]["id"])}
          ariaLabel={t("tablistLabel")}
          className="flex"
          tabClassName={TAB_CLASS}
        />
        <button
          type="button"
          aria-pressed={isAiTab}
          onClick={() => setActive(AI_TAB_ID)}
          className={cn(
            TAB_CLASS,
            "ml-auto border-l border-fd-border pl-3",
            isAiTab ? "text-fd-foreground" : "text-fd-muted-foreground hover:text-fd-foreground",
          )}
          style={isAiTab ? { boxShadow: "inset 0 -2px 0 var(--v-glow)" } : undefined}
        >
          {t("aiTabLabel")}
        </button>
      </div>
      <div
        className="flex items-center gap-3 px-4 py-3 font-mono text-sm"
        style={{ background: "var(--surface-bg)" }}
      >
        {isAiTab ? null : (
          <span aria-hidden="true" style={{ color: "var(--v-glow)" }}>
            $
          </span>
        )}
        <code
          aria-hidden={isAiTab || undefined}
          className={cn("text-fd-foreground", isAiTab && "block min-w-0 flex-1 truncate")}
        >
          {isAiTab ? (
            commandText
          ) : (
            <HighlightedCommand command={commandText} link={{ token: CLI_TOKEN, href: NPM_CLI }} />
          )}
        </code>
        <button
          type="button"
          onClick={() => copy(commandText)}
          aria-label={isAiTab ? t("copyPromptAria") : t("copyAria")}
          className="ms-auto rounded-md border border-fd-border px-2 py-1 text-xs text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          {copied ? t("copied") : t("copy")}
        </button>
      </div>
      {active === "pnpm" ? (
        <p
          className="border-t border-fd-border px-4 py-2.5 text-xs leading-relaxed text-fd-muted-foreground"
          style={{ background: "var(--surface-bg)" }}
        >
          {t("pnpmNote")}{" "}
          <a
            href={localizedPath(locale, "/docs/troubleshooting")}
            className="underline decoration-fd-border underline-offset-4 transition-colors hover:text-[var(--accent)] hover:decoration-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            {t("pnpmNoteLink")}
          </a>
        </p>
      ) : isAiTab ? (
        <p
          className="border-t border-fd-border px-4 py-2.5 text-xs leading-relaxed text-fd-muted-foreground"
          style={{ background: "var(--surface-bg)" }}
        >
          {t("aiCaption")}{" "}
          <a
            href={localizedPath(locale, "/docs/start-with-ai")}
            className="underline decoration-fd-border underline-offset-4 transition-colors hover:text-[var(--accent)] hover:decoration-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            {t("aiCaptionLink")}
          </a>
        </p>
      ) : null}
    </div>
  );
}
