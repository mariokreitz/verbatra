import type { ReactNode } from "react";
import { Button } from "./Button.js";

export interface PaginationProps {
  readonly page: number;
  readonly pageCount: number;
  readonly onChange: (page: number) => void;
}

/**
 * Previous/next plus a "page X of Y" readout. No list in Studio is paged today (Diff/Status
 * render their full, already-capped data in one view, see `client/filter.ts`'s
 * `filterAndCapKeys`), so nothing calls this yet; kept as a ready primitive rather than built the
 * day a genuinely large, page-worthy list appears.
 */
export function Pagination({ page, pageCount, onChange }: PaginationProps): ReactNode {
  return (
    <nav className="flex items-center gap-3 text-sm text-muted-foreground" aria-label="Pagination">
      <Button disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
        &#8592;
      </Button>
      <span>
        Page {page} of {pageCount}
      </span>
      <Button
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
      >
        &#8594;
      </Button>
    </nav>
  );
}
