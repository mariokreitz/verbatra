import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "./lib/cn.js";

export interface PopoverProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly anchor: ReactNode;
  readonly children: ReactNode;
  readonly align?: "start" | "end";
  readonly ariaLabel?: string | undefined;
}

export function Popover({
  open,
  onClose,
  anchor,
  children,
  align = "start",
  ariaLabel,
}: PopoverProps): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: PointerEvent): void {
      if (!containerRef.current?.contains(event.target as Node)) {
        onClose();
      }
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <div className="relative inline-block" ref={containerRef}>
      {anchor}
      {open ? (
        <div
          className={cn(
            "absolute top-full z-30 mt-1 min-w-[180px] rounded-lg border border-border bg-card p-2 shadow-panel-lg",
            align === "end" ? "end-0" : "start-0",
          )}
          {...(ariaLabel !== undefined
            ? { role: "dialog", "aria-modal": false, "aria-label": ariaLabel }
            : {})}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
