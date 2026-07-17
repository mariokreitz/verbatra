import { describe, expect, it, vi } from "vitest";
import { createReviewOverlayStore } from "./review-overlay.js";

describe("createReviewOverlayStore", () => {
  it("starts with nothing actioned", () => {
    const store = createReviewOverlayStore();
    expect(store.isActioned({ locale: "de", key: "greeting" })).toBe(false);
  });

  it("marks exactly the actioned entry, leaving other entries and other keys/locales unaffected", () => {
    const store = createReviewOverlayStore();
    store.markActioned({ locale: "de", key: "greeting" });

    expect(store.isActioned({ locale: "de", key: "greeting" })).toBe(true);
    expect(store.isActioned({ locale: "de", key: "farewell" })).toBe(false);
    expect(store.isActioned({ locale: "fr", key: "greeting" })).toBe(false);
  });

  it("tracks multiple actioned entries independently", () => {
    const store = createReviewOverlayStore();
    store.markActioned({ locale: "de", key: "greeting" });
    store.markActioned({ locale: "fr", key: "farewell" });

    expect(store.isActioned({ locale: "de", key: "greeting" })).toBe(true);
    expect(store.isActioned({ locale: "fr", key: "farewell" })).toBe(true);
    expect(store.isActioned({ locale: "de", key: "farewell" })).toBe(false);
  });

  it("notifies subscribers exactly once per genuinely new markActioned call", () => {
    const store = createReviewOverlayStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.markActioned({ locale: "de", key: "greeting" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("is idempotent: marking an already-actioned entry again notifies no one", () => {
    const store = createReviewOverlayStore();
    const listener = vi.fn();
    store.markActioned({ locale: "de", key: "greeting" });
    store.subscribe(listener);

    store.markActioned({ locale: "de", key: "greeting" });
    expect(listener).not.toHaveBeenCalled();
  });

  it("stops notifying an unsubscribed listener", () => {
    const store = createReviewOverlayStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();

    store.markActioned({ locale: "de", key: "greeting" });
    expect(listener).not.toHaveBeenCalled();
  });

  it("a fresh instance starts empty, simulating the reset-on-reload behavior", () => {
    const first = createReviewOverlayStore();
    first.markActioned({ locale: "de", key: "greeting" });

    const second = createReviewOverlayStore();
    expect(second.isActioned({ locale: "de", key: "greeting" })).toBe(false);
  });

  it("distinguishes a locale/key pair from an unrelated pair sharing only one field, never colliding on a naive string join", () => {
    const store = createReviewOverlayStore();
    store.markActioned({ locale: "de x", key: "y" });

    expect(store.isActioned({ locale: "de", key: "x y" })).toBe(false);
  });
});
