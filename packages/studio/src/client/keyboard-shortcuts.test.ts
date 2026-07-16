import { describe, expect, it } from "vitest";
import {
  type HelpShortcutEvent,
  isEditableTagName,
  isHelpShortcut,
  KEYBOARD_SHORTCUTS,
} from "./keyboard-shortcuts.js";

function keyEvent(overrides: Partial<HelpShortcutEvent> = {}): HelpShortcutEvent {
  return { key: "?", ctrlKey: false, metaKey: false, altKey: false, ...overrides };
}

describe("isHelpShortcut", () => {
  it("matches a bare question mark outside editable targets", () => {
    expect(isHelpShortcut(keyEvent(), false)).toBe(true);
  });

  it("never fires while typing in an editable control", () => {
    expect(isHelpShortcut(keyEvent(), true)).toBe(false);
  });

  it("ignores other keys", () => {
    expect(isHelpShortcut(keyEvent({ key: "/" }), false)).toBe(false);
    expect(isHelpShortcut(keyEvent({ key: "k" }), false)).toBe(false);
  });

  it("ignores modifier-chorded question marks", () => {
    expect(isHelpShortcut(keyEvent({ ctrlKey: true }), false)).toBe(false);
    expect(isHelpShortcut(keyEvent({ metaKey: true }), false)).toBe(false);
    expect(isHelpShortcut(keyEvent({ altKey: true }), false)).toBe(false);
  });
});

describe("isEditableTagName", () => {
  it.each([
    "INPUT",
    "TEXTAREA",
    "SELECT",
    "input",
    "textarea",
    "select",
  ])("treats %s as editable", (tagName) => {
    expect(isEditableTagName(tagName)).toBe(true);
  });

  it.each(["DIV", "BUTTON", "A", "TABLE"])("treats %s as not editable", (tagName) => {
    expect(isEditableTagName(tagName)).toBe(false);
  });
});

describe("KEYBOARD_SHORTCUTS", () => {
  it("documents the palette shortcut and the overview's own binding", () => {
    const descriptions = KEYBOARD_SHORTCUTS.map((shortcut) => shortcut.description);
    expect(descriptions.some((text) => text.includes("command palette"))).toBe(true);
    expect(descriptions.some((text) => text.includes("shortcuts overview"))).toBe(true);
  });

  it("gives every entry at least one key chip and a description", () => {
    for (const shortcut of KEYBOARD_SHORTCUTS) {
      expect(shortcut.keys.length).toBeGreaterThan(0);
      expect(shortcut.description.length).toBeGreaterThan(0);
    }
  });
});
