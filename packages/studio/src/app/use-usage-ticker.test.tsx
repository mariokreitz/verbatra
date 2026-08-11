// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { RefreshableView } from "../client/state.js";
import type { UsageTickerData } from "../client/usage-ticker-data.js";
import { flush, render, renderAsync, rpcCalls, rpcError, stubRpc } from "./test-support.js";
import { useUsageTicker } from "./use-usage-ticker.js";

vi.mock("./api.js", () => import("./test-support.js").then((module) => module.apiMock()));

const TRACKED: UsageTickerData = {
  available: true,
  generatedAt: "2026-05-01T09:12:00Z",
  usage: { inputTokens: 12_400, outputTokens: 8_200 },
  budget: {
    maxTokens: 50_000,
    behavior: "warn",
    supported: true,
    tokensUsed: 20_600,
    exceeded: false,
  },
};

const LATER_RUN: UsageTickerData = {
  available: true,
  generatedAt: "2026-05-02T10:30:00Z",
  usage: { inputTokens: 30_000, outputTokens: 21_000 },
  budget: {
    maxTokens: 50_000,
    behavior: "stop",
    supported: true,
    tokensUsed: 51_000,
    exceeded: true,
  },
};

function usageAnswer(result: UsageTickerData): { readonly ok: true; readonly result: unknown } {
  return { ok: true, result };
}

let seen: RefreshableView<UsageTickerData> = { kind: "loading" };

function Probe({ token }: { readonly token?: number }): ReactNode {
  seen = useUsageTicker(token);
  return <span data-testid="kind">{seen.kind}</span>;
}

describe("useUsageTicker", () => {
  it("starts in the loading state before usage.summary answers", () => {
    stubRpc({ "usage.summary": () => new Promise(() => {}) });

    const view = render(<Probe />);

    expect(view.text()).toBe("loading");
  });

  it("passes the run-wide token and budget snapshot through unchanged", async () => {
    stubRpc({ "usage.summary": usageAnswer(TRACKED) });

    const view = await renderAsync(<Probe />);

    expect(view.text()).toBe("data");
    expect(seen).toEqual({ kind: "data", data: TRACKED, stale: false });
  });

  it("treats a project that has never run as data, not as an error", async () => {
    stubRpc({ "usage.summary": usageAnswer({ available: false }) });

    const view = await renderAsync(<Probe />);

    expect(view.text()).toBe("data");
    expect(seen).toEqual({ kind: "data", data: { available: false }, stale: false });
  });

  it("reads the run-wide summary, which takes no parameters", async () => {
    stubRpc({ "usage.summary": usageAnswer(TRACKED) });

    await renderAsync(<Probe />);

    expect(rpcCalls).toEqual([{ method: "usage.summary", params: {} }]);
  });

  it("renders a hard error when the very first read fails, since there is nothing to keep", async () => {
    stubRpc({ "usage.summary": rpcError("SESSION_EXPIRED", "the session has expired") });

    const view = await renderAsync(<Probe />);

    expect(view.text()).toBe("error");
    expect(seen).toEqual({
      kind: "error",
      error: { code: "SESSION_EXPIRED", message: "the session has expired" },
    });
  });

  it("replaces the ticker with the fresh read when the refresh token changes", async () => {
    let call = 0;
    stubRpc({
      "usage.summary": () => {
        call += 1;
        return usageAnswer(call === 1 ? TRACKED : LATER_RUN);
      },
    });

    const view = await renderAsync(<Probe token={1} />);
    view.rerender(<Probe token={2} />);
    await flush();

    expect(seen).toEqual({ kind: "data", data: LATER_RUN, stale: false });
    expect(rpcCalls).toHaveLength(2);
  });

  it("keeps the last good totals and marks them stale when a re-read fails", async () => {
    let call = 0;
    stubRpc({
      "usage.summary": () => {
        call += 1;
        return call === 1 ? usageAnswer(TRACKED) : rpcError("READ_FAILED", "snapshot unreadable");
      },
    });

    const view = await renderAsync(<Probe token={1} />);
    view.rerender(<Probe token={2} />);
    await flush();

    expect(view.text()).toBe("data");
    expect(seen).toEqual({
      kind: "data",
      data: TRACKED,
      stale: true,
      error: { code: "READ_FAILED", message: "snapshot unreadable" },
    });
  });

  it("ignores an answer that arrives after the caller unmounted", async () => {
    let answer: (() => void) | undefined;
    const pending = new Promise<{ readonly ok: true; readonly result: unknown }>((resolve) => {
      answer = () => {
        resolve(usageAnswer(TRACKED));
      };
    });
    stubRpc({ "usage.summary": () => pending });

    const view = await renderAsync(<Probe />);
    view.unmount();
    seen = { kind: "loading" };
    answer?.();
    await pending;
    await flush();

    expect(seen).toEqual({ kind: "loading" });
  });
});
