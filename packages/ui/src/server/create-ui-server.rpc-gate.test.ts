import { afterEach, describe, expect, it } from "vitest";
import { startUiServer } from "./create-ui-server.js";
import type { UiServer } from "./types.js";

const TOKEN = "rpc-gate-test-token-0123456789abcdef";

async function authenticatedCookie(url: string, token: string): Promise<string> {
  const response = await fetch(`${url}?token=${token}`, { redirect: "manual" });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie === null) {
    throw new Error("expected a Set-Cookie header from bootstrap");
  }
  return setCookie.split(";")[0] ?? "";
}

describe("POST /rpc method and transport policy", () => {
  let server: UiServer | undefined;
  let cookie = "";

  afterEach(async () => {
    if (server) {
      await server.close();
      server = undefined;
    }
  });

  async function start(): Promise<void> {
    server = await startUiServer({ port: 0, token: TOKEN });
    cookie = await authenticatedCookie(server.url, TOKEN);
  }

  it("reaches the not-yet-implemented rpc handler on a well-formed authenticated request", async () => {
    await start();
    if (server === undefined) {
      throw new Error("server not started");
    }

    const response = await fetch(new URL("/rpc", server.url), {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
        Origin: server.url.replace(/\/$/, ""),
      },
      body: "{}",
    });

    expect(response.status).toBe(501);
  });

  it("rejects an unauthenticated POST /rpc with 401 before checking content type", async () => {
    await start();
    if (server === undefined) {
      throw new Error("server not started");
    }

    const response = await fetch(new URL("/rpc", server.url), {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "{}",
    });

    expect(response.status).toBe(401);
  });

  it("rejects a charset parameter on Content-Type with 415", async () => {
    await start();
    if (server === undefined) {
      throw new Error("server not started");
    }

    const response = await fetch(new URL("/rpc", server.url), {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json; charset=utf-8" },
      body: "{}",
    });

    expect(response.status).toBe(415);
  });

  it("rejects a POST to a path other than /rpc with 404, even with a correct content type", async () => {
    await start();
    if (server === undefined) {
      throw new Error("server not started");
    }

    const response = await fetch(new URL("/other", server.url), {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: "{}",
    });

    expect(response.status).toBe(404);
  });

  it("rejects a body over the 1 MiB cap with 413 via a declared Content-Length", async () => {
    await start();
    if (server === undefined) {
      throw new Error("server not started");
    }

    const response = await fetch(new URL("/rpc", server.url), {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: "a".repeat(1024 * 1024 + 1),
    });

    expect(response.status).toBe(413);
  });

  it("rejects methods other than GET, POST, and OPTIONS with 405", async () => {
    await start();
    if (server === undefined) {
      throw new Error("server not started");
    }

    const response = await fetch(server.url, { method: "PUT" });

    expect(response.status).toBe(405);
  });

  it("rejects DELETE with 405", async () => {
    await start();
    if (server === undefined) {
      throw new Error("server not started");
    }

    const response = await fetch(server.url, { method: "DELETE" });

    expect(response.status).toBe(405);
  });
});
