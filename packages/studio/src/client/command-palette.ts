import type { DiffLocale, KeyLocaleStatus } from "./diff-view.js";

/** One tab jump target the palette can render, built from the app shell's own tab list. */
export interface PaletteTabCommand {
  readonly kind: "tab";
  readonly id: string;
  readonly tab: string;
  readonly label: string;
}

/** One key/locale jump target, available once the Diff panel has loaded data this session. */
export interface PaletteKeyCommand {
  readonly kind: "key";
  readonly id: string;
  readonly keyName: string;
  readonly locale: string;
  readonly status: KeyLocaleStatus;
  readonly label: string;
}

/**
 * Every entry the palette can render. Deliberately data-only: neither variant carries a callback,
 * a network request, or a file write, so a command can never be anything other than what
 * {@link resolvePaletteSelection} turns it into, a tab switch or a key-drawer open, both plain
 * navigation.
 */
export type PaletteCommand = PaletteTabCommand | PaletteKeyCommand;

/** A tab entry the app shell already knows about: its id and display label. */
export interface PaletteTabDescriptor {
  readonly tab: string;
  readonly label: string;
}

/** The three key lists a `DiffLocale` carries; `in-sync` has no list of its own, so it is excluded. */
const DRIFT_KINDS: readonly ("missing" | "changed" | "orphaned")[] = [
  "missing",
  "changed",
  "orphaned",
];

function tabCommand(descriptor: PaletteTabDescriptor): PaletteTabCommand {
  return { kind: "tab", id: `tab:${descriptor.tab}`, tab: descriptor.tab, label: descriptor.label };
}

function keyCommand(locale: string, keyName: string, status: KeyLocaleStatus): PaletteKeyCommand {
  return {
    kind: "key",
    id: `key:${locale}:${status}:${keyName}`,
    keyName,
    locale,
    status,
    label: `${keyName} - ${locale} (${status})`,
  };
}

function keyCommandsForLocale(locale: DiffLocale): readonly PaletteKeyCommand[] {
  const commands: PaletteKeyCommand[] = [];
  for (const status of DRIFT_KINDS) {
    for (const keyName of locale[status]) {
      commands.push(keyCommand(locale.locale, keyName, status));
    }
  }
  return commands;
}

/**
 * Builds the full palette command list: one entry per tab, plus, when `diffLocales` is not `null`
 * (the Diff panel has loaded a `status.diff` result at least once this session), one entry per
 * pending key/locale combination (missing, changed, or orphaned; a key fully in sync in a locale
 * never appears in that locale's key lists, the same scoping `diff-view.ts`'s `driftKeys`
 * documents). No RPC call is ever made here: `diffLocales` is whatever the caller already has
 * cached (see `client/diff-session.ts`), so a session where the Diff panel was never opened still
 * gets every tab target, including a "Diff" entry that navigates there and triggers its existing
 * fetch.
 */
export function buildPaletteCommands(
  tabs: readonly PaletteTabDescriptor[],
  diffLocales: readonly DiffLocale[] | null,
): readonly PaletteCommand[] {
  const tabCommands = tabs.map(tabCommand);
  if (diffLocales === null) {
    return tabCommands;
  }
  return [...tabCommands, ...diffLocales.flatMap(keyCommandsForLocale)];
}

/**
 * The maximum number of matching commands rendered at once, mirroring `filter.ts`'s
 * `MAX_RENDERED_KEYS` render cap (G24) for the same reason: an unfiltered, multi-locale diff can
 * produce far more key/locale entries than are useful to paint into an open overlay at once.
 */
export const MAX_PALETTE_RESULTS = 50;

/**
 * Filters the full command list by a case-insensitive substring match against each command's
 * label, the same matching rule `filter.ts`'s `filterAndCapKeys` already uses for the Diff panel's
 * own key filter, then caps the result at {@link MAX_PALETTE_RESULTS}. A blank or whitespace-only
 * query matches everything.
 */
export function filterPaletteCommands(
  commands: readonly PaletteCommand[],
  query: string,
): readonly PaletteCommand[] {
  const needle = query.trim().toLowerCase();
  const matches =
    needle === ""
      ? commands
      : commands.filter((command) => command.label.toLowerCase().includes(needle));
  return matches.slice(0, MAX_PALETTE_RESULTS);
}

/** The page every key/locale command resolves to: the Translations workspace hosts the key
 * explorer and its detail drawer (see `client/routes.ts`'s page vocabulary). */
export const KEY_JUMP_PAGE_ID = "translations";

/** The navigation action a selected palette command resolves to: a plain data value, never a function. */
export type PaletteSelection =
  | { readonly kind: "switch-tab"; readonly tab: string }
  | { readonly kind: "open-key"; readonly tab: string; readonly keyName: string };

/**
 * Resolves what selecting a command should do. A tab command switches to it. A key command
 * switches to the Diff tab and opens that key's detail drawer, matching what a manual click on
 * that key already does (the caller carries this out through `client/diff-session.ts`'s
 * `OpenKeyStore`, so a key selection here never triggers a fresh RPC call either).
 */
export function resolvePaletteSelection(command: PaletteCommand): PaletteSelection {
  if (command.kind === "tab") {
    return { kind: "switch-tab", tab: command.tab };
  }
  return { kind: "open-key", tab: KEY_JUMP_PAGE_ID, keyName: command.keyName };
}

/** The minimal keyboard-event shape this module needs; avoids depending on the DOM lib's KeyboardEvent. */
export interface PaletteShortcutEvent {
  readonly key: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
}

/** True for the palette's open shortcut: Cmd+K on Mac (metaKey), Ctrl+K elsewhere (ctrlKey). */
export function isPaletteShortcut(event: PaletteShortcutEvent): boolean {
  return event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
}
