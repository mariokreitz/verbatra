/**
 * The keyboard-shortcuts overview: the "?" shortcut that opens it and the catalog of shortcuts
 * it documents. The catalog is data, not behavior; every entry describes a binding some other
 * part of the app already implements (the palette shortcut in `command-palette.ts`, Esc and the
 * grid keys in their own components), so this file is the one place that list is written down.
 */

/** Minimal keyboard-event shape, mirroring `command-palette.ts`'s `PaletteShortcutEvent`. */
export interface HelpShortcutEvent {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
}

/**
 * Whether a keydown should open the shortcuts overview: a bare "?" (Shift is inherent to typing
 * "?" on most layouts, so only the other modifiers disqualify), and never while the target is an
 * editable control, where "?" is ordinary typed text. The caller derives `targetIsEditable` from
 * the real event target (see `isEditableTagName`); this function stays DOM-free.
 */
export function isHelpShortcut(event: HelpShortcutEvent, targetIsEditable: boolean): boolean {
  return (
    !targetIsEditable && event.key === "?" && !event.ctrlKey && !event.metaKey && !event.altKey
  );
}

/** Tag names whose focused element consumes ordinary character keys as text entry. The caller
 * additionally checks `isContentEditable`, which no tag name can express. */
export function isEditableTagName(tagName: string): boolean {
  const upper = tagName.toUpperCase();
  return upper === "INPUT" || upper === "TEXTAREA" || upper === "SELECT";
}

/** One documented shortcut: the key chips to render and what the binding does. */
export interface ShortcutDescriptor {
  readonly keys: readonly string[];
  readonly description: string;
}

/** Every binding the dashboard implements, in display order. */
export const KEYBOARD_SHORTCUTS: readonly ShortcutDescriptor[] = [
  { keys: ["Ctrl/⌘", "K"], description: "Open the command palette" },
  { keys: ["?"], description: "Open this shortcuts overview" },
  { keys: ["Esc"], description: "Close the open dialog, drawer, or menu" },
  { keys: ["Arrow keys"], description: "Move between cells in the translations key grid" },
  { keys: ["Enter", "Space"], description: "Open the focused grid key's details" },
];
