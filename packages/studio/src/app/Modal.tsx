import type { ReactNode, Ref } from "react";
import { DialogCloseButton, OverlayBackdrop } from "./ui.js";

export interface ModalProps {
  readonly title: ReactNode;
  readonly ariaLabel: string;
  readonly closeLabel: string;
  readonly onClose: () => void;
  readonly containerRef: Ref<HTMLDivElement>;
  readonly children: ReactNode;
}

/**
 * A centered overlay dialog, over an `OverlayBackdrop`: the "pop up in the middle of the screen"
 * shape, as opposed to `Sheet`'s edge-anchored panel. This dashboard's own overlays (key detail,
 * edit entry) are all edge-anchored `Sheet`s today; `Modal` is the centered alternative for a
 * future caller whose content is better framed than slid in (a confirmation, a short form). The
 * focus trap ref (`useDialogA11y`) is threaded in rather than owned here, matching `Sheet`'s own
 * convention, since each caller opens the dialog with its own `onClose`.
 */
export function Modal({
  title,
  ariaLabel,
  closeLabel,
  onClose,
  containerRef,
  children,
}: ModalProps): ReactNode {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center p-4">
      <OverlayBackdrop onClose={onClose} label={closeLabel} />
      <div
        className="relative z-10 max-h-[85vh] w-[min(480px,100%)] overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-panel-lg"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        ref={containerRef}
      >
        <div className="mb-6 flex items-start justify-between gap-3">
          <h2 className="m-0 break-words font-semibold text-foreground">{title}</h2>
          <DialogCloseButton onClose={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}
