import type { ReactNode } from "react";
import { Card } from "./Card.js";

/**
 * A fixed-position, `role="status"` toast shell in the viewport's
 * bottom-right corner. Purely positioning and card treatment; the caller
 * brings the content.
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
