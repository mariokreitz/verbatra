import type { ReactNode, Ref } from "react";
import { cn } from "./lib/cn.js";
import { DialogCloseButton, OverlayBackdrop } from "./ui.js";

export type SheetSide = "start" | "end" | "top" | "bottom";

const CONTAINER_CLASSNAME: Readonly<Record<SheetSide, string>> = {
  start: "justify-start",
  end: "justify-end",
  top: "items-start",
  bottom: "items-end",
};

const PANEL_CLASSNAME: Readonly<Record<SheetSide, string>> = {
  start: "h-full w-[min(420px,100%)] border-e",
  end: "h-full w-[min(420px,100%)] border-s",
  top: "w-full max-h-[80vh] border-b",
  bottom: "w-full max-h-[80vh] border-t",
};

export interface SheetProps {
  /** Which edge the panel slides in from. Defaults to "end" (the drawer shape `DrawerShell`
   * already used for the key detail and edit-entry overlays). */
  readonly side?: SheetSide;
  readonly title: ReactNode;
  readonly ariaLabel: string;
  readonly closeLabel: string;
  readonly onClose: () => void;
  readonly containerRef: Ref<HTMLDivElement>;
  readonly children: ReactNode;
}

/**
 * A panel anchored to one edge of the viewport, over an `OverlayBackdrop`, with a title and a
 * close button. The general form of `ui.tsx`'s `DrawerShell` (which is now a thin `side="end"`
 * wrapper around this): {@link SheetSide} covers the other three edges a caller might want a
 * panel to slide in from. The focus trap ref (`useDialogA11y`) is threaded in rather than owned
 * here, since each caller opens the dialog with its own `onClose` and the hook must be called
 * from the component that owns that closure.
 */
export function Sheet({
  side = "end",
  title,
  ariaLabel,
  closeLabel,
  onClose,
  containerRef,
  children,
}: SheetProps): ReactNode {
  return (
    <div className={cn("fixed inset-0 z-20 flex", CONTAINER_CLASSNAME[side])}>
      <OverlayBackdrop onClose={onClose} label={closeLabel} />
      <div
        className={cn(
          "relative z-10 overflow-y-auto border-border bg-card p-6 shadow-panel-lg",
          PANEL_CLASSNAME[side],
        )}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        ref={containerRef}
      >
        <div className="mb-6 flex items-start justify-between gap-3">
          <h2 className="m-0 break-words font-mono text-lg font-semibold text-foreground">
            {title}
          </h2>
          <DialogCloseButton onClose={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}
