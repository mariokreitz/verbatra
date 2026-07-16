import type { ReactNode } from "react";
import { Icon } from "./Icon.js";
import { cn } from "./lib/cn.js";
import { Kbd } from "./ui.js";

/**
 * The search-styled pill that opens the command palette: a bordered field look with no real
 * input underneath, since typing a query only ever happens inside the palette itself once open.
 * Lives in the top bar on desktop and in the mobile nav drawer; the shortcut hint names both
 * modifier keys because this dashboard cannot know the visitor's platform.
 */
export function SearchTrigger({
  onOpenSearch,
  className,
}: {
  readonly onOpenSearch: () => void;
  readonly className?: string;
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onOpenSearch}
      className={cn(
        "flex w-52 items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-muted-foreground transition-colors",
        "hover:bg-accent hover:text-foreground",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
        className,
      )}
    >
      <span className="flex items-center gap-2">
        <Icon name="search" size={14} />
        Search…
      </span>
      <Kbd>Ctrl/&#8984; K</Kbd>
    </button>
  );
}
