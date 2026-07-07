import { describe, expect, it } from "vitest";
import { applyRefreshOutcome, createSessionStore, type RefreshableView } from "./state.js";

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

describe("applyRefreshOutcome", () => {
  const ERROR = { code: "SOURCE_UNREADABLE", message: "bad source" };

  it("a success from loading renders fresh, non-stale data", () => {
    const previous: RefreshableView<number> = { kind: "loading" };

    const next = applyRefreshOutcome(previous, { ok: true, result: 1 });

    expect(next).toEqual({ kind: "data", data: 1, stale: false });
  });

  it("a success from existing data replaces it and clears any prior stale flag", () => {
    const previous: RefreshableView<number> = { kind: "data", data: 1, stale: true, error: ERROR };

    const next = applyRefreshOutcome(previous, { ok: true, result: 2 });

    expect(next).toEqual({ kind: "data", data: 2, stale: false });
  });

  it("a failure with prior good data keeps that data, marked stale, with the new error", () => {
    const previous: RefreshableView<number> = { kind: "data", data: 1, stale: false };

    const next = applyRefreshOutcome(previous, { ok: false, error: ERROR });

    expect(next).toEqual({ kind: "data", data: 1, stale: true, error: ERROR });
  });

  it("a failure with prior data already marked stale keeps the same data, still stale, with the newest error", () => {
    const staleError = { code: "OLD", message: "old error" };
    const previous: RefreshableView<number> = {
      kind: "data",
      data: 1,
      stale: true,
      error: staleError,
    };

    const next = applyRefreshOutcome(previous, { ok: false, error: ERROR });

    expect(next).toEqual({ kind: "data", data: 1, stale: true, error: ERROR });
  });

  it("a failure from loading, with no prior data at all, renders as a hard error", () => {
    const previous: RefreshableView<number> = { kind: "loading" };

    const next = applyRefreshOutcome(previous, { ok: false, error: ERROR });

    expect(next).toEqual({ kind: "error", error: ERROR });
  });

  it("a failure from a prior hard error stays a hard error with the newest message", () => {
    const previous: RefreshableView<number> = {
      kind: "error",
      error: { code: "OLD", message: "old" },
    };

    const next = applyRefreshOutcome(previous, { ok: false, error: ERROR });

    expect(next).toEqual({ kind: "error", error: ERROR });
  });
});
