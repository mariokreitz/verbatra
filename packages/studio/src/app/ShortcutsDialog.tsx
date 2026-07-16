import type { ReactNode } from "react";
import { KEYBOARD_SHORTCUTS } from "../client/keyboard-shortcuts.js";
import { Modal } from "./Modal.js";
import { Kbd } from "./ui.js";
import { useDialogA11y } from "./use-dialog-a11y.js";

/**
 * The keyboard-shortcuts overview, a centered `Modal` opened by "?" or the top bar's keyboard
 * button. Pure documentation of bindings that exist elsewhere (see
 * `client/keyboard-shortcuts.ts`); it makes the dashboard's keyboard surface discoverable, which
 * a keyboard-first layout otherwise never is. Mounted only while open, matching this dashboard's
 * mount-is-open overlay convention, so `useDialogA11y` always runs with `isOpen: true`.
 */
export function ShortcutsDialog({ onClose }: { readonly onClose: () => void }): ReactNode {
  const containerRef = useDialogA11y<HTMLDivElement>({ isOpen: true, onClose });

  return (
    <Modal
      title="Keyboard shortcuts"
      ariaLabel="Keyboard shortcuts"
      closeLabel="Close the keyboard shortcuts overview"
      onClose={onClose}
      containerRef={containerRef}
    >
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {KEYBOARD_SHORTCUTS.map((shortcut) => (
          <li
            key={shortcut.description}
            className="flex items-center justify-between gap-4 text-sm text-foreground"
          >
            {shortcut.description}
            <span className="flex flex-none items-center gap-1">
              {shortcut.keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
