import type { ReactNode } from "react";
import { microLabelClassName } from "./ui.js";

/**
 * The one page-title block every panel opens with: a monospace kicker naming the product area
 * (the design reference's "PROJECT CONFIGURATION" eyebrow), an h1 (the document's only h1), an
 * optional one-line description of what the view shows, and an optional inline-end slot for the
 * page's contextual actions (for example the Translations panel's copy-as-report button).
 * Rendered by the panels rather than the app shell so each panel owns its own copy and actions.
 */
export function PageHeader({
  kicker = "Verbatra Studio",
  title,
  description,
  actions,
}: {
  /** The eyebrow line above the title; defaults to the product name. */
  readonly kicker?: string;
  readonly title: string;
  readonly description?: string;
  readonly actions?: ReactNode;
}): ReactNode {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <p className={`mb-1 ${microLabelClassName}`}>{kicker}</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {description !== undefined ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions !== undefined ? (
        <div className="flex flex-none items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
