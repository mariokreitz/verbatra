import type { ReactNode } from "react";

export interface BreadcrumbItem {
  readonly label: string;
}

/**
 * A plain, non-interactive trail (no crumb here links anywhere: the dashboard's IA is one level
 * deep, a nav group then a section, so there is never a middle crumb to navigate back to that the
 * sidebar doesn't already show). Purely orientation: "you are in Translations, on Diff."
 */
export function Breadcrumbs({ items }: { readonly items: readonly BreadcrumbItem[] }): ReactNode {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      <ol className="m-0 flex list-none items-center gap-2 p-0">
        {items.map((item, index) => (
          <li key={item.label} className="flex items-center gap-2">
            {index > 0 ? (
              <span aria-hidden="true" className="text-muted-foreground/50">
                /
              </span>
            ) : null}
            {index === items.length - 1 ? (
              <span aria-current="page" className="text-foreground">
                {item.label}
              </span>
            ) : (
              item.label
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
