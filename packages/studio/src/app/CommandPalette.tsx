import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  buildPaletteCommands,
  filterPaletteCommands,
  type PaletteCommand,
  type PaletteTabDescriptor,
  resolvePaletteSelection,
} from "../client/command-palette.js";
import { diffDataStore, openKeyStore } from "./api.js";
import { useDialogA11y } from "./use-dialog-a11y.js";

export interface CommandPaletteProps {
  /** The app shell's own tab list (id and label), the source of every tab jump target. */
  readonly tabs: readonly PaletteTabDescriptor[];
  readonly onSelectTab: (tab: string) => void;
  readonly onClose: () => void;
}

/**
 * A read-only, keyboard-driven overlay listing every navigation target: the app's tabs, plus, once
 * the Diff panel has loaded data this session, every pending key/locale combination. Every entry is
 * pure navigation: `client/command-palette.ts`'s `PaletteCommand` is plain data and can never carry
 * a callback, a network request, or a file write. Selecting a tab entry switches to it; selecting a
 * key entry switches to the Diff tab and asks it to open that key's detail drawer through the
 * shared `OpenKeyStore`, the exact path a manual click on that key already uses, so this never
 * triggers a fresh RPC call (see `client/diff-session.ts`).
 *
 * Built on the same overlay primitives `KeyDetailDrawer.tsx` already uses: `useDialogA11y` for the
 * focus trap, Esc-to-close, and focus restoration, and a real backdrop-dismiss button rather than a
 * click handler on a static element. This component is only ever mounted while open (the app shell
 * conditionally renders it, matching `KeyDetailDrawer`'s own mount-is-open convention), so
 * `useDialogA11y` is always called with `isOpen: true`. The filter input is the first element in
 * document order inside the dialog container, so the focus trap's "focus the first focusable
 * element on open" behavior lands on it, letting a user type immediately after Cmd+K/Ctrl+K.
 */
export function CommandPalette({ tabs, onSelectTab, onClose }: CommandPaletteProps): ReactNode {
  const [query, setQuery] = useState("");
  const [diffLocales, setDiffLocales] = useState(diffDataStore.getState());
  const containerRef = useDialogA11y<HTMLDivElement>({ isOpen: true, onClose });

  useEffect(() => diffDataStore.subscribe(setDiffLocales), []);

  const commands = buildPaletteCommands(tabs, diffLocales);
  const results = filterPaletteCommands(commands, query);
  const [firstResult] = results;

  function handleSelect(command: PaletteCommand): void {
    const selection = resolvePaletteSelection(command);
    if (selection.kind === "open-key") {
      openKeyStore.request(selection.keyName);
    }
    onSelectTab(selection.tab);
    onClose();
  }

  function onQueryChange(event: ChangeEvent<HTMLInputElement>): void {
    setQuery(event.target.value);
  }

  function onInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter" && firstResult !== undefined) {
      handleSelect(firstResult);
    }
  }

  return (
    <div className="palette-backdrop">
      <button
        type="button"
        className="palette-backdrop-dismiss"
        onClick={onClose}
        aria-label="Close command palette"
      />
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        ref={containerRef}
      >
        <input
          type="text"
          className="palette-input"
          placeholder="Jump to a tab, key, or locale"
          value={query}
          onChange={onQueryChange}
          onKeyDown={onInputKeyDown}
        />
        <ul className="palette-results">
          {results.map((command) => (
            <li key={command.id}>
              <button
                type="button"
                className="palette-result"
                onClick={() => handleSelect(command)}
              >
                {command.label}
              </button>
            </li>
          ))}
          {results.length === 0 ? <li className="palette-empty">No matches.</li> : null}
        </ul>
      </div>
    </div>
  );
}
