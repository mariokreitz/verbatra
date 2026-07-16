import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/** Options for {@link useDialogA11y}. */
export interface DialogA11yOptions {
  /** Whether the dialog is currently open; the trap and its listeners are only live while true. */
  readonly isOpen: boolean;
  /** Called on Escape. The caller owns unmounting or hiding the dialog; this hook never does it itself. */
  readonly onClose: () => void;
}

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

function trapTabKey(event: KeyboardEvent, container: HTMLElement): void {
  const items = focusableElements(container);
  const first = items[0];
  const last = items[items.length - 1];
  if (first === undefined || last === undefined) {
    return;
  }
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Shared accessibility behavior for overlay dialogs: on open, focus moves to
 * the first focusable element inside the returned container ref; Tab and
 * Shift+Tab cycle within the container (a focus trap); Escape calls
 * `onClose`; and on close or unmount, focus returns to the element focused
 * beforehand. The latest `onClose` is tracked through a ref rather than an
 * effect dependency, so a caller may pass a new callback identity on every
 * render without tearing down and rebuilding the trap.
 *
 * @returns The ref to attach to the dialog's container element.
 */
export function useDialogA11y<T extends HTMLElement>({
  isOpen,
  onClose,
}: DialogA11yOptions): RefObject<T | null> {
  const containerRef = useRef<T | null>(null);
  const onCloseRef = useRef(onClose);

  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const container = containerRef.current;
    if (container !== null) {
      focusableElements(container)[0]?.focus();
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key === "Tab" && container !== null) {
        trapTabKey(event, container);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  return containerRef;
}
