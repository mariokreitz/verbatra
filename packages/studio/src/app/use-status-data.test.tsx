// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { StatusData } from "../client/coverage.js";
import type { RefreshableView } from "../client/state.js";
import type { StatusCheckResult } from "../shared/rpc/check.js";
import { flush, render, renderAsync, rpcCalls, rpcError, stubRpc } from "./test-support.js";
import { useStatusData } from "./use-status-data.js";

vi.mock("./api.js", () => import("./test-support.js").then((module) => module.apiMock()));

const BEHIND: StatusCheckResult = {
  inSync: false,
  locales: [
    { locale: "de", missing: 2, stale: 1, upToDate: 7, inSync: false },
    { locale: "fr", missing: 0, stale: 0, upToDate: 10, inSync: true },
  ],
};

const CAUGHT_UP: StatusCheckResult = {
  inSync: true,
  locales: [
    { locale: "de", missing: 0, stale: 0, upToDate: 10, inSync: true },
    { locale: "fr", missing: 0, stale: 0, upToDate: 10, inSync: true },
  ],
};

const BEHIND_DATA: StatusData = {
  inSync: false,
  rows: [
    { locale: "de", missing: 2, stale: 1, upToDate: 7, inSync: false, percent: 70 },
    { locale: "fr", missing: 0, stale: 0, upToDate: 10, inSync: true, percent: 100 },
  ],
};

function checkAnswer(result: StatusCheckResult): { readonly ok: true; readonly result: unknown } {
  return { ok: true, result };
}

let seen: RefreshableView<StatusData> = { kind: "loading" };

function Probe({ token }: { readonly token?: number }): ReactNode {
  seen = useStatusData(token);
  return <span data-testid="kind">{seen.kind}</span>;
}

describe("useStatusData", () => {
  it("starts in the loading state before status.check answers", () => {
    stubRpc({ "status.check": () => new Promise(() => {}) });

    const view = render(<Probe />);

    expect(view.text()).toBe("loading");
  });

  it("exposes fresh coverage rows with the percentage derived per locale", async () => {
    stubRpc({ "status.check": checkAnswer(BEHIND) });

    const view = await renderAsync(<Probe />);

    expect(view.text()).toBe("data");
    expect(seen).toEqual({ kind: "data", data: BEHIND_DATA, stale: false });
  });

  it("checks every configured locale, passing no locale filter of its own", async () => {
    stubRpc({ "status.check": checkAnswer(CAUGHT_UP) });

    await renderAsync(<Probe />);

    expect(rpcCalls).toEqual([{ method: "status.check", params: {} }]);
  });

  it("renders a hard error when the very first read fails, since there is nothing to keep", async () => {
    stubRpc({ "status.check": rpcError("CONFIG_INVALID", "verbatra.config.ts has no locales") });

    const view = await renderAsync(<Probe />);

    expect(view.text()).toBe("error");
    expect(seen).toEqual({
      kind: "error",
      error: { code: "CONFIG_INVALID", message: "verbatra.config.ts has no locales" },
    });
  });

  it("replaces the data with the fresh read when the refresh token changes", async () => {
    let call = 0;
    stubRpc({
      "status.check": () => {
        call += 1;
        return checkAnswer(call === 1 ? BEHIND : CAUGHT_UP);
      },
    });

    const view = await renderAsync(<Probe token={1} />);
    view.rerender(<Probe token={2} />);
    await flush();

    expect(seen).toEqual({
      kind: "data",
      data: {
        inSync: true,
        rows: [
          { locale: "de", missing: 0, stale: 0, upToDate: 10, inSync: true, percent: 100 },
          { locale: "fr", missing: 0, stale: 0, upToDate: 10, inSync: true, percent: 100 },
        ],
      },
      stale: false,
    });
    expect(rpcCalls).toHaveLength(2);
  });

  it("keeps the last good coverage and marks it stale when a re-read fails", async () => {
    let call = 0;
    stubRpc({
      "status.check": () => {
        call += 1;
        return call === 1 ? checkAnswer(BEHIND) : rpcError("LOCK_FILE_INVALID", "lock file broken");
      },
    });

    const view = await renderAsync(<Probe token={1} />);
    view.rerender(<Probe token={2} />);
    await flush();

    expect(view.text()).toBe("data");
    expect(seen).toEqual({
      kind: "data",
      data: BEHIND_DATA,
      stale: true,
      error: { code: "LOCK_FILE_INVALID", message: "lock file broken" },
    });
  });

  it("ignores an answer that arrives after the caller unmounted", async () => {
    let answer: (() => void) | undefined;
    const pending = new Promise<{ readonly ok: true; readonly result: unknown }>((resolve) => {
      answer = () => {
        resolve(checkAnswer(BEHIND));
      };
    });
    stubRpc({ "status.check": () => pending });

    const view = await renderAsync(<Probe />);
    view.unmount();
    seen = { kind: "loading" };
    answer?.();
    await pending;
    await flush();

    expect(seen).toEqual({ kind: "loading" });
  });
});
