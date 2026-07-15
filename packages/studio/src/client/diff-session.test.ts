import { describe, expect, it } from "vitest";
import { createDiffDataStore, createOpenKeyStore } from "./diff-session.js";
import type { DiffLocale } from "./diff-view.js";

const LOCALES: readonly DiffLocale[] = [
  { locale: "de", hasPendingChanges: true, missing: ["greeting"], changed: [], orphaned: [] },
];

describe("createDiffDataStore", () => {
  it("starts with no cached data", () => {
    const store = createDiffDataStore();

    expect(store.getState()).toBeNull();
  });

  it("caches locales and notifies subscribers", () => {
    const store = createDiffDataStore();
    const seen: (readonly DiffLocale[] | null)[] = [];
    store.subscribe((locales) => seen.push(locales));

    store.setLocales(LOCALES);

    expect(store.getState()).toBe(LOCALES);
    expect(seen).toEqual([LOCALES]);
  });

  it("replaces previously cached locales on a later load", () => {
    const store = createDiffDataStore();
    store.setLocales(LOCALES);

    const nextLocales: readonly DiffLocale[] = [];
    store.setLocales(nextLocales);

    expect(store.getState()).toBe(nextLocales);
  });

  it("stops notifying an unsubscribed listener", () => {
    const store = createDiffDataStore();
    const seen: (readonly DiffLocale[] | null)[] = [];
    const unsubscribe = store.subscribe((locales) => seen.push(locales));
    unsubscribe();

    store.setLocales(LOCALES);

    expect(seen).toEqual([]);
  });
});

describe("createOpenKeyStore", () => {
  it("starts with no pending request", () => {
    const store = createOpenKeyStore();

    expect(store.getState()).toBeNull();
  });

  it("records a request and notifies subscribers", () => {
    const store = createOpenKeyStore();
    const seen: (string | null)[] = [];
    store.subscribe((keyName) => seen.push(keyName));

    store.request("greeting");

    expect(store.getState()).toBe("greeting");
    expect(seen).toEqual(["greeting"]);
  });

  it("notifies again for a repeat request of the same key", () => {
    const store = createOpenKeyStore();
    const seen: (string | null)[] = [];
    store.request("greeting");
    store.subscribe((keyName) => seen.push(keyName));

    store.request("greeting");

    expect(seen).toEqual(["greeting"]);
  });

  it("clears a pending request and notifies subscribers", () => {
    const store = createOpenKeyStore();
    const seen: (string | null)[] = [];
    store.request("greeting");
    store.subscribe((keyName) => seen.push(keyName));

    store.clear();

    expect(store.getState()).toBeNull();
    expect(seen).toEqual([null]);
  });

  it("does not notify when clearing an already-empty store", () => {
    const store = createOpenKeyStore();
    const seen: (string | null)[] = [];
    store.subscribe((keyName) => seen.push(keyName));

    store.clear();

    expect(seen).toEqual([]);
  });

  it("stops notifying an unsubscribed listener", () => {
    const store = createOpenKeyStore();
    const seen: (string | null)[] = [];
    const unsubscribe = store.subscribe((keyName) => seen.push(keyName));
    unsubscribe();

    store.request("greeting");

    expect(seen).toEqual([]);
  });
});
