import { describe, expect, it } from "vitest";
import {
  buildPaletteCommands,
  DIFF_TAB_ID,
  filterPaletteCommands,
  isPaletteShortcut,
  MAX_PALETTE_RESULTS,
  type PaletteCommand,
  type PaletteTabDescriptor,
  resolvePaletteSelection,
} from "./command-palette.js";
import type { DiffLocale } from "./diff-view.js";

const TABS: readonly PaletteTabDescriptor[] = [
  { tab: "overview", label: "Overview" },
  { tab: "status", label: "Status" },
  { tab: "diff", label: "Diff" },
  { tab: "lock", label: "Lock" },
  { tab: "history", label: "History" },
];

const LOCALES: readonly DiffLocale[] = [
  {
    locale: "de",
    hasPendingChanges: true,
    missing: ["greeting"],
    changed: ["farewell"],
    orphaned: ["old.key"],
  },
  {
    locale: "fr",
    hasPendingChanges: true,
    missing: ["greeting"],
    changed: [],
    orphaned: [],
  },
];

describe("buildPaletteCommands", () => {
  it("returns only the five tab commands when the Diff panel has not loaded data", () => {
    const commands = buildPaletteCommands(TABS, null);

    expect(commands).toHaveLength(5);
    expect(commands.every((command) => command.kind === "tab")).toBe(true);
  });

  it("includes one command per tab plus one per key/locale drift entry once diff data is loaded", () => {
    const commands = buildPaletteCommands(TABS, LOCALES);

    const tabCommands = commands.filter((command) => command.kind === "tab");
    const keyCommands = commands.filter((command) => command.kind === "key");
    expect(tabCommands).toHaveLength(5);
    // de: 1 missing + 1 changed + 1 orphaned; fr: 1 missing. 4 total.
    expect(keyCommands).toHaveLength(4);
  });

  it("never produces a key command for a locale with no drift", () => {
    const inSync: readonly DiffLocale[] = [
      { locale: "es", hasPendingChanges: false, missing: [], changed: [], orphaned: [] },
    ];

    const commands = buildPaletteCommands(TABS, inSync);

    expect(commands.filter((command) => command.kind === "key")).toHaveLength(0);
  });

  it("no rendered command carries anything beyond a tab switch or a key open, never a write, network, or provider affordance", () => {
    const commands = buildPaletteCommands(TABS, LOCALES);

    for (const command of commands) {
      const selection = resolvePaletteSelection(command);
      expect(["switch-tab", "open-key"]).toContain(selection.kind);
      // Every field on the resolved selection is a plain string, never a function: there is
      // nothing here that could invoke a network call, a file write, or a provider call.
      for (const value of Object.values(selection)) {
        expect(typeof value).toBe("string");
      }
    }
  });
});

describe("filterPaletteCommands", () => {
  const commands = buildPaletteCommands(TABS, LOCALES);

  it("returns every command for a blank query", () => {
    expect(filterPaletteCommands(commands, "")).toHaveLength(commands.length);
    expect(filterPaletteCommands(commands, "   ")).toHaveLength(commands.length);
  });

  it("matches a tab label case-insensitively", () => {
    const result = filterPaletteCommands(commands, "OVERVIEW");

    expect(result).toHaveLength(1);
    expect(result[0]?.label).toBe("Overview");
  });

  it("matches a key command by key name", () => {
    const result = filterPaletteCommands(commands, "farewell");

    expect(result).toHaveLength(1);
    expect(result[0]?.kind).toBe("key");
  });

  it("matches a key command by locale", () => {
    const result = filterPaletteCommands(commands, "fr");

    expect(result.every((command) => command.kind === "key" && command.locale === "fr")).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns nothing for a query that matches no label", () => {
    expect(filterPaletteCommands(commands, "no-such-entry")).toEqual([]);
  });

  it("caps results at MAX_PALETTE_RESULTS", () => {
    const many: readonly DiffLocale[] = [
      {
        locale: "de",
        hasPendingChanges: true,
        missing: Array.from({ length: MAX_PALETTE_RESULTS + 20 }, (_, index) => `key.${index}`),
        changed: [],
        orphaned: [],
      },
    ];

    const result = filterPaletteCommands(buildPaletteCommands([], many), "key");

    expect(result).toHaveLength(MAX_PALETTE_RESULTS);
  });
});

describe("resolvePaletteSelection", () => {
  it("resolves a tab command to a tab switch", () => {
    const command: PaletteCommand = {
      kind: "tab",
      id: "tab:status",
      tab: "status",
      label: "Status",
    };

    expect(resolvePaletteSelection(command)).toEqual({ kind: "switch-tab", tab: "status" });
  });

  it("resolves a key command to opening the Diff tab for that key", () => {
    const command: PaletteCommand = {
      kind: "key",
      id: "key:de:missing:greeting",
      keyName: "greeting",
      locale: "de",
      status: "missing",
      label: "greeting - de (missing)",
    };

    expect(resolvePaletteSelection(command)).toEqual({
      kind: "open-key",
      tab: DIFF_TAB_ID,
      keyName: "greeting",
    });
  });
});

describe("isPaletteShortcut", () => {
  it("matches Cmd+K", () => {
    expect(isPaletteShortcut({ key: "k", metaKey: true, ctrlKey: false })).toBe(true);
  });

  it("matches Ctrl+K", () => {
    expect(isPaletteShortcut({ key: "k", metaKey: false, ctrlKey: true })).toBe(true);
  });

  it("matches an uppercase K (Shift held)", () => {
    expect(isPaletteShortcut({ key: "K", metaKey: true, ctrlKey: false })).toBe(true);
  });

  it("does not match K without a modifier", () => {
    expect(isPaletteShortcut({ key: "k", metaKey: false, ctrlKey: false })).toBe(false);
  });

  it("does not match a different key with a modifier held", () => {
    expect(isPaletteShortcut({ key: "j", metaKey: true, ctrlKey: false })).toBe(false);
  });
});
