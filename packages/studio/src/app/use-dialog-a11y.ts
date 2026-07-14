import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

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
 * Shared accessibility behavior for interactive chrome that opens as an overlay: Esc closes it, Tab
 * and Shift+Tab cycle within the container instead of escaping to the rest of the page (a focus
 * trap), and focus returns to whatever was focused before the container opened, once it closes.
 * The key detail drawer is the first consumer; a future keyboard-navigable grid is expected to
 * reuse this alongside the pure roving-tabindex math in `client/roving-tabindex.ts` (that helper
 * covers moving focus within a list of items, which this hook does not do on its own).
 *
 * Not covered by the coverage gate: `src/app` is excluded (see `vitest.config.ts`), and this
 * module is DOM-interaction logic (real focus, real keydown listeners) with no jsdom or
 * browser-rendering harness in this package's current toolchain. Manually verified by tracing the
 * effect: on open, focus moves to the first focusable element inside the container; Tab from the
 * last focusable element wraps to the first and Shift+Tab from the first wraps to the last; Escape
 * invokes `onClose`; on close (or unmount), focus returns to the element that was focused
 * beforehand.
 */
export function useDialogA11y<T extends HTMLElement>({
  isOpen,
  onClose,
}: DialogA11yOptions): RefObject<T | null> {
  const containerRef = useRef<T | null>(null);
  // Tracks the latest onClose without being a setup-effect dependency: a caller like the Diff
  // panel passes a new onClose identity on every render (live refresh included), and reacting to
  // that identity change would tear down and rebuild the trap on every re-render instead of only
  // when the dialog actually opens or closes.
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
