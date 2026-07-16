import type { ReactNode } from "react";
import { Card } from "./Card.js";

/**
 * The fixed-position, `role="status"` toast shell `RefreshToast` renders its live-refresh content
 * into. Extracted so a future second toast use case (this dashboard has one live slot today, see
 * `client/refresh-toast.ts`'s one-slot rule) reuses the same positioning and card treatment
 * instead of re-deriving it.
 */
export function Toast({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <Card
      padding="sm"
      role="status"
      className="fixed bottom-6 right-6 z-40 flex w-[min(360px,calc(100vw-3rem))] flex-col gap-2 shadow-panel-lg"
    >
      {children}
    </Card>
  );
}
