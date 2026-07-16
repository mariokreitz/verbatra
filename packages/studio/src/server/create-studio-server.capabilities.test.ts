import { describe, expect, it } from "vitest";
import {
  authenticatedCookie,
  fixtureLoader,
  makeFixtureProject,
  stubLoader,
  withServer,
} from "./test-support.js";

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
 * Direct proof (B6) that a spend-gated method is unreachable through dispatch on a default server:
 * both rows of the spend table for `translation.retranslateEntry` specifically, not only the read
 * methods' own unaffected behavior.
 */
describe("translation.retranslateEntry reachability across the spend table", () => {
  it("returns METHOD_UNKNOWN on a default server (no spend)", async () => {
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

  it("returns METHOD_UNKNOWN when spend is explicitly false", async () => {
    await withServer(
      async (server) => {
        const cookie = await authenticatedCookie(server.url, TOKEN);
        const { body } = await postRpc(server.url, cookie, "translation.retranslateEntry", {
          locale: "de",
          key: "greeting",
        });
        expect(body).toMatchObject({ ok: false, error: { code: "METHOD_UNKNOWN" } });
      },
      { token: TOKEN, loader: stubLoader(), spend: false },
    );
  });

  it("reaches the real handler (not METHOD_UNKNOWN) with spend set, no other flag needed", async () => {
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
      { token: TOKEN, loader: stubLoader(), spend: true },
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
      { token: TOKEN, loader: stubLoader(), spend: true },
    );
  });
});

describe("project.snapshot's capabilities projection reflects the resolved flags", () => {
  it("reports spend false and writeToDisk true by default", async () => {
    await withServer(
      async (server) => {
        const cookie = await authenticatedCookie(server.url, TOKEN);
        const { body } = await postRpc(server.url, cookie, "project.snapshot");
        expect(body).toMatchObject({
          ok: true,
          result: { capabilities: { spend: false, writeToDisk: true } },
        });
      },
      { token: TOKEN, loader: stubLoader() },
    );
  });

  it("reports both true when spend is set", async () => {
    await withServer(
      async (server) => {
        const cookie = await authenticatedCookie(server.url, TOKEN);
        const { body } = await postRpc(server.url, cookie, "project.snapshot");
        expect(body).toMatchObject({
          ok: true,
          result: { capabilities: { spend: true, writeToDisk: true } },
        });
      },
      { token: TOKEN, loader: stubLoader(), spend: true },
    );
  });
});

/**
 * Direct proof that `translation.editEntry` and `key.value` are always registered, independent of
 * `spend`: local editing needs no capability flag, so a default server already dispatches both.
 */
describe("translation.editEntry and key.value reachability on a default server", () => {
  it("reaches the real handlers (not METHOD_UNKNOWN) on a default server, no flag needed", async () => {
    await withServer(
      async (server) => {
        const cookie = await authenticatedCookie(server.url, TOKEN);
        const edit = await postRpc(server.url, cookie, "translation.editEntry", {
          locale: "de",
          key: "greeting",
          value: "Hallo",
        });
        const value = await postRpc(server.url, cookie, "key.value", {
          locale: "de",
          key: "greeting",
        });
        // The stub project has no real source file on disk, so both handlers fail with a domain
        // error, not METHOD_UNKNOWN; reaching a different error code is exactly the proof both
        // are registered and invoked.
        expect(edit.body.ok).toBe(false);
        expect(edit.body.error?.code).not.toBe("METHOD_UNKNOWN");
        expect(value.body.ok).toBe(false);
        expect(value.body.error?.code).not.toBe("METHOD_UNKNOWN");
      },
      { token: TOKEN, loader: stubLoader() },
    );
  });

  it("reaches the real handlers with spend also set", async () => {
    await withServer(
      async (server) => {
        const cookie = await authenticatedCookie(server.url, TOKEN);
        const edit = await postRpc(server.url, cookie, "translation.editEntry", {
          locale: "de",
          key: "greeting",
          value: "Hallo",
        });
        expect(edit.body.error?.code).not.toBe("METHOD_UNKNOWN");
      },
      { token: TOKEN, loader: stubLoader(), spend: true },
    );
  });
});

describe("translation.editEntry is reachable on a default server, no flag at all", () => {
  it("completes a real edit end to end against a fixture project with no capability option set", async () => {
    const project = await makeFixtureProject({ targetLocales: ["de"] }, { greeting: "hello" });
    try {
      await withServer(
        async (server) => {
          const cookie = await authenticatedCookie(server.url, TOKEN);
          const result = await postRpc(server.url, cookie, "translation.editEntry", {
            locale: "de",
            key: "greeting",
            value: "Hallo",
          });
          expect(result.status).toBe(200);
          expect(result.body).toMatchObject({
            ok: true,
            result: { accepted: true, value: "Hallo" },
          });
        },
        {
          token: TOKEN,
          loader: fixtureLoader(project),
          cwd: project.root,
        },
      );
    } finally {
      await project.cleanup();
    }
  });
});

describe("translation.editEntry's dispatch-layer rate limit, wired end to end", () => {
  it("trips after the configured ceiling and a call under the limit is unaffected", async () => {
    await withServer(
      async (server) => {
        const cookie = await authenticatedCookie(server.url, TOKEN);
        const first = await postRpc(server.url, cookie, "translation.editEntry", {
          locale: "de",
          key: "greeting",
          value: "Hallo",
        });
        expect(first.body.error?.code).not.toBe("RATE_LIMITED");

        const second = await postRpc(server.url, cookie, "translation.editEntry", {
          locale: "de",
          key: "greeting",
          value: "Hallo",
        });
        expect(second.body.error?.code).not.toBe("RATE_LIMITED");

        const third = await postRpc(server.url, cookie, "translation.editEntry", {
          locale: "de",
          key: "greeting",
          value: "Hallo",
        });
        expect(third.status).toBe(429);
        expect(third.body).toMatchObject({ ok: false, error: { code: "RATE_LIMITED" } });
      },
      {
        token: TOKEN,
        loader: stubLoader(),
        editEntryRateLimitWindowMs: 60_000,
        editEntryRateLimitMax: 2,
      },
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
        retranslateRateLimitWindowMs: 60_000,
        retranslateRateLimitMax: 2,
      },
    );
  });
});

/**
 * Direct proof (write-half addendum criterion 1) that a spend-gated method is unreachable through
 * dispatch without the spend capability, mirroring `translation.retranslateEntry`'s own table
 * above.
 */
describe("translation.translatePending reachability across the spend table", () => {
  it("returns METHOD_UNKNOWN on a default server (no spend)", async () => {
    await withServer(
      async (server) => {
        const cookie = await authenticatedCookie(server.url, TOKEN);
        const { status, body } = await postRpc(server.url, cookie, "translation.translatePending");
        expect(status).toBe(400);
        expect(body).toMatchObject({ ok: false, error: { code: "METHOD_UNKNOWN" } });
      },
      { token: TOKEN, loader: stubLoader() },
    );
  });

  it("returns METHOD_UNKNOWN when spend is explicitly false", async () => {
    await withServer(
      async (server) => {
        const cookie = await authenticatedCookie(server.url, TOKEN);
        const { body } = await postRpc(server.url, cookie, "translation.translatePending");
        expect(body).toMatchObject({ ok: false, error: { code: "METHOD_UNKNOWN" } });
      },
      { token: TOKEN, loader: stubLoader(), spend: false },
    );
  });

  it("reaches the real handler (not METHOD_UNKNOWN) with spend set, no other flag needed", async () => {
    await withServer(
      async (server) => {
        const cookie = await authenticatedCookie(server.url, TOKEN);
        const { body } = await postRpc(server.url, cookie, "translation.translatePending");
        // The stub project has no real source file on disk, so the handler itself fails (a
        // domain error, not METHOD_UNKNOWN); reaching a different error code is exactly the proof
        // the handler is now registered and invoked.
        expect(body.ok).toBe(false);
        expect(body.error?.code).not.toBe("METHOD_UNKNOWN");
      },
      { token: TOKEN, loader: stubLoader(), spend: true },
    );
  });

  it("the params schema still rejects an unexpected key regardless of capability state", async () => {
    await withServer(
      async (server) => {
        const cookie = await authenticatedCookie(server.url, TOKEN);
        const { body } = await postRpc(server.url, cookie, "translation.translatePending", {
          locale: "de",
        });
        expect(body).toMatchObject({ ok: false, error: { code: "PARAMS_INVALID" } });
      },
      { token: TOKEN, loader: stubLoader(), spend: true },
    );
  });

  it("the params schema still rejects an unexpected key even without the spend capability", async () => {
    // The shared params schema is looked up and validated before the handler registry is ever
    // consulted (rpc-gate.ts's invokeHandler), so PARAMS_INVALID for a malformed body is not
    // itself gated on capability state, unlike the handler's own reachability above.
    await withServer(
      async (server) => {
        const cookie = await authenticatedCookie(server.url, TOKEN);
        const { body } = await postRpc(server.url, cookie, "translation.translatePending", {
          locale: "de",
        });
        expect(body).toMatchObject({ ok: false, error: { code: "PARAMS_INVALID" } });
      },
      { token: TOKEN, loader: stubLoader() },
    );
  });
});

describe("translation.translatePending completes a real run end to end", () => {
  it("translates every configured target locale against a real fixture project", async () => {
    const project = await makeFixtureProject({ targetLocales: ["de"] }, { greeting: "hello" });
    try {
      await withServer(
        async (server) => {
          const cookie = await authenticatedCookie(server.url, TOKEN);
          const result = await postRpc(server.url, cookie, "translation.translatePending");
          expect(result.status).toBe(200);
          expect(result.body).toMatchObject({ ok: true, result: { succeeded: ["de"] } });
        },
        {
          token: TOKEN,
          loader: fixtureLoader(project),
          cwd: project.root,
          spend: true,
          createProvider: () => ({
            id: "stub",
            kind: "llm",
            supportsGlossary: true,
            translateBatch: async (request) => ({
              values: new Map(request.entries.map((entry) => [entry.key, "Hallo"])),
              integrity: new Map(),
            }),
          }),
        },
      );
    } finally {
      await project.cleanup();
    }
  });
});

describe("translation.translatePending's dispatch-layer rate limit, wired end to end", () => {
  it("trips after the configured ceiling and a call under the limit is unaffected", async () => {
    await withServer(
      async (server) => {
        const cookie = await authenticatedCookie(server.url, TOKEN);
        const first = await postRpc(server.url, cookie, "translation.translatePending");
        expect(first.body.error?.code).not.toBe("RATE_LIMITED");

        const second = await postRpc(server.url, cookie, "translation.translatePending");
        expect(second.body.error?.code).not.toBe("RATE_LIMITED");

        const third = await postRpc(server.url, cookie, "translation.translatePending");
        expect(third.status).toBe(429);
        expect(third.body).toMatchObject({ ok: false, error: { code: "RATE_LIMITED" } });
      },
      {
        token: TOKEN,
        loader: stubLoader(),
        spend: true,
        translatePendingRateLimitWindowMs: 60_000,
        translatePendingRateLimitMax: 2,
      },
    );
  });
});

/** A promise a test can resolve on its own schedule, plus the resolver itself. */
function deferred<T>(): { readonly promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Polls `hasArrived` until it reports true, rather than a fixed delay: real, end-to-end HTTP
 * requests have no fixed latency bound under CI/system load, so waiting for the actual signal the
 * test cares about (the first call's handler has genuinely reached and is now blocked inside the
 * provider) is the only way to make "the second call overlaps the first" deterministic instead of
 * a guess at how long that should take.
 */
async function waitUntil(hasArrived: () => boolean): Promise<void> {
  while (!hasArrived()) {
    await sleep(5);
  }
}

describe("translation.translatePending's process-wide in-flight guard, wired end to end", () => {
  it("rejects a second overlapping call with ALREADY_IN_PROGRESS before the sdk seam runs, without blocking it on the first call's real lock, and a later call after the first settles proceeds normally", async () => {
    const project = await makeFixtureProject({ targetLocales: ["de"] }, { greeting: "hello" });
    try {
      const gate = deferred<void>();
      let providerCalls = 0;

      await withServer(
        async (server) => {
          const cookie = await authenticatedCookie(server.url, TOKEN);

          // Fired but not awaited: this call's handler blocks inside the provider until the test
          // resolves `gate`, holding the in-flight marker for the whole window below.
          const firstCall = postRpc(server.url, cookie, "translation.translatePending");

          // Wait for the real signal that the first call's handler has reached the provider (and
          // is now blocked on `gate`), not a fixed delay: this is what makes the second call a
          // genuine overlap regardless of how loaded the machine running this test is.
          await waitUntil(() => providerCalls > 0);

          const second = await postRpc(server.url, cookie, "translation.translatePending");
          expect(second.status).toBe(409);
          expect(second.body).toMatchObject({ ok: false, error: { code: "ALREADY_IN_PROGRESS" } });
          // The rejection arrived without the provider having been reached a second time: proof
          // the second call never touched the sdk seam, not merely that it eventually lost a race.
          expect(providerCalls).toBe(1);

          gate.resolve();
          const first = await firstCall;
          expect(first.body.error?.code).not.toBe("ALREADY_IN_PROGRESS");

          // A call issued after the first has fully settled is not permanently blocked by a stuck flag.
          const third = await postRpc(server.url, cookie, "translation.translatePending");
          expect(third.body.error?.code).not.toBe("ALREADY_IN_PROGRESS");
        },
        {
          token: TOKEN,
          loader: fixtureLoader(project),
          cwd: project.root,
          spend: true,
          createProvider: () => ({
            id: "stub",
            kind: "llm",
            supportsGlossary: true,
            translateBatch: async (request) => {
              providerCalls += 1;
              await gate.promise;
              return {
                values: new Map(request.entries.map((entry) => [entry.key, "Hallo"])),
                integrity: new Map(),
              };
            },
          }),
        },
      );
    } finally {
      await project.cleanup();
    }
  });
});
