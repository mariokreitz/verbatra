import { describe, expect, it } from "vitest";
import { createSessionStore } from "./state.js";

describe("createSessionStore", () => {
  it("starts active", () => {
    const store = createSessionStore();

    expect(store.getState()).toEqual({ kind: "active" });
  });

  it("transitions to session-expired and notifies subscribers", () => {
    const store = createSessionStore();
    const seen: string[] = [];
    store.subscribe((state) => seen.push(state.kind));

    store.markSessionExpired();

    expect(store.getState()).toEqual({ kind: "session-expired" });
    expect(seen).toEqual(["session-expired"]);
  });

  it("is idempotent: a second markSessionExpired does not notify again", () => {
    const store = createSessionStore();
    const seen: string[] = [];
    store.subscribe((state) => seen.push(state.kind));

    store.markSessionExpired();
    store.markSessionExpired();

    expect(seen).toEqual(["session-expired"]);
  });

  it("stops notifying an unsubscribed listener", () => {
    const store = createSessionStore();
    const seen: string[] = [];
    const unsubscribe = store.subscribe((state) => seen.push(state.kind));
    unsubscribe();

    store.markSessionExpired();

    expect(seen).toEqual([]);
  });

  it("supports more than one subscriber", () => {
    const store = createSessionStore();
    const first: string[] = [];
    const second: string[] = [];
    store.subscribe((state) => first.push(state.kind));
    store.subscribe((state) => second.push(state.kind));

    store.markSessionExpired();

    expect(first).toEqual(["session-expired"]);
    expect(second).toEqual(["session-expired"]);
  });
});
