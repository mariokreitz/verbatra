import type { ReactNode } from "react";

/**
 * The one page-title block every panel opens with: an h1 (the document's only h1), an optional
 * one-line description of what the view shows, and an optional inline-end slot for the page's
 * contextual actions (for example the Diff panel's copy-as-report button). Rendered by the
 * panels rather than the app shell so each panel owns its own copy and actions; the shell's
 * breadcrumb trail stays the cross-panel orientation device.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  readonly title: string;
  readonly description?: string;
  readonly actions?: ReactNode;
}): ReactNode {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
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
