import { describe, expect, it } from "vitest";
import { authenticatedCookie, stubLoader, withServer } from "./test-support.js";

interface RpcResponseBody {
  readonly ok: boolean;
  readonly error?: { readonly code: string };
  readonly result?: unknown;
}

async function postRpc(
  url: string,
  cookie: string,
  method: string,
  params: Record<string, unknown> = {},
): Promise<{ status: number; body: RpcResponseBody }> {
  const response = await fetch(new URL("/rpc", url), {
    method: "POST",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
      Origin: url.replace(/\/$/, ""),
    },
    body: JSON.stringify({ method, params }),
  });
  return { status: response.status, body: (await response.json()) as RpcResponseBody };
}

const TOKEN = "capabilities-test-token-0123456789abcdef";

/**
 * Direct proof (B6) that a disabled write method is unreachable through dispatch, and that both
 * capabilities are required together: every row of the two-permission table for
 * `translation.retranslateEntry` specifically, not only the read methods' own unaffected behavior.
 */
describe("translation.retranslateEntry reachability across the capability table", () => {
  it("returns METHOD_UNKNOWN with neither capability set", async () => {
    await withServer(
      async (server) => {
        const cookie = await authenticatedCookie(server.url, TOKEN);
        const { status, body } = await postRpc(server.url, cookie, "translation.retranslateEntry", {
          locale: "de",
          key: "greeting",
        });
        expect(status).toBe(400);
        expect(body).toMatchObject({ ok: false, error: { code: "METHOD_UNKNOWN" } });
      },
      { token: TOKEN, loader: stubLoader() },
    );
  });

  it("returns METHOD_UNKNOWN with only spend set", async () => {
    await withServer(
      async (server) => {
        const cookie = await authenticatedCookie(server.url, TOKEN);
        const { body } = await postRpc(server.url, cookie, "translation.retranslateEntry", {
          locale: "de",
          key: "greeting",
        });
        expect(body).toMatchObject({ ok: false, error: { code: "METHOD_UNKNOWN" } });
      },
      { token: TOKEN, loader: stubLoader(), spend: true, writeToDisk: false },
    );
  });

  it("returns METHOD_UNKNOWN with only writeToDisk set", async () => {
    await withServer(
      async (server) => {
        const cookie = await authenticatedCookie(server.url, TOKEN);
        const { body } = await postRpc(server.url, cookie, "translation.retranslateEntry", {
          locale: "de",
          key: "greeting",
        });
        expect(body).toMatchObject({ ok: false, error: { code: "METHOD_UNKNOWN" } });
      },
      { token: TOKEN, loader: stubLoader(), spend: false, writeToDisk: true },
    );
  });

  it("reaches the real handler (not METHOD_UNKNOWN) with both capabilities set", async () => {
    await withServer(
      async (server) => {
        const cookie = await authenticatedCookie(server.url, TOKEN);
        const { body } = await postRpc(server.url, cookie, "translation.retranslateEntry", {
          locale: "de",
          key: "greeting",
        });
        // The stub project has no real source file on disk, so the handler itself fails (a
        // domain error, not METHOD_UNKNOWN); reaching a different error code is exactly the proof
        // the handler is now registered and invoked.
        expect(body.ok).toBe(false);
        expect(body.error?.code).not.toBe("METHOD_UNKNOWN");
      },
      { token: TOKEN, loader: stubLoader(), spend: true, writeToDisk: true },
    );
  });

  it("the params schema still validates a malformed body regardless of capability state", async () => {
    await withServer(
      async (server) => {
        const cookie = await authenticatedCookie(server.url, TOKEN);
        const { body } = await postRpc(server.url, cookie, "translation.retranslateEntry", {
          locale: "",
          key: "greeting",
        });
        expect(body).toMatchObject({ ok: false, error: { code: "PARAMS_INVALID" } });
      },
      { token: TOKEN, loader: stubLoader(), spend: true, writeToDisk: true },
    );
  });
});

describe("project.snapshot's capabilities projection reflects the resolved flags", () => {
  it("reports both false by default", async () => {
    await withServer(
      async (server) => {
        const cookie = await authenticatedCookie(server.url, TOKEN);
        const { body } = await postRpc(server.url, cookie, "project.snapshot");
        expect(body).toMatchObject({
          ok: true,
          result: { capabilities: { spend: false, writeToDisk: false } },
        });
      },
      { token: TOKEN, loader: stubLoader() },
    );
  });

  it("reports both true when both flags are set", async () => {
    await withServer(
      async (server) => {
        const cookie = await authenticatedCookie(server.url, TOKEN);
        const { body } = await postRpc(server.url, cookie, "project.snapshot");
        expect(body).toMatchObject({
          ok: true,
          result: { capabilities: { spend: true, writeToDisk: true } },
        });
      },
      { token: TOKEN, loader: stubLoader(), spend: true, writeToDisk: true },
    );
  });
});

describe("translation.retranslateEntry's dispatch-layer rate limit, wired end to end", () => {
  it("trips after the configured ceiling and a call under the limit is unaffected", async () => {
    await withServer(
      async (server) => {
        const cookie = await authenticatedCookie(server.url, TOKEN);
        const first = await postRpc(server.url, cookie, "translation.retranslateEntry", {
          locale: "de",
          key: "greeting",
        });
        // Under the limit (the first of two allowed calls): reaches the handler, so it is not
        // rate-limited, whatever else it fails on (no real source file on disk here).
        expect(first.body.error?.code).not.toBe("RATE_LIMITED");

        const second = await postRpc(server.url, cookie, "translation.retranslateEntry", {
          locale: "de",
          key: "greeting",
        });
        expect(second.body.error?.code).not.toBe("RATE_LIMITED");

        const third = await postRpc(server.url, cookie, "translation.retranslateEntry", {
          locale: "de",
          key: "greeting",
        });
        expect(third.status).toBe(429);
        expect(third.body).toMatchObject({ ok: false, error: { code: "RATE_LIMITED" } });
      },
      {
        token: TOKEN,
        loader: stubLoader(),
        spend: true,
        writeToDisk: true,
        retranslateRateLimitWindowMs: 60_000,
        retranslateRateLimitMax: 2,
      },
    );
  });
});
