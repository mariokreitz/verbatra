"use client";

import { type ReactNode, useState } from "react";

export type CommandLineProps = {
  command: string;
  link?: { token: string; href: string };
};

export default function CommandLine({ command, link }: CommandLineProps): ReactNode {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

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
              className="rounded underline decoration-fd-border underline-offset-4 transition-colors hover:text-[var(--accent)] hover:decoration-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
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
