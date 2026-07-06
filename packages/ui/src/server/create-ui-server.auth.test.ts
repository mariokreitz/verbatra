import { afterEach, describe, expect, it } from "vitest";
import { startUiServer } from "./create-ui-server.js";
import { stubLoader } from "./test-support.js";
import type { UiServer } from "./types.js";

const TOKEN = "auth-flow-test-token-abcdef0123456789";

async function bootstrap(url: string, token: string): Promise<Response> {
  return fetch(`${url}?token=${token}`, { redirect: "manual" });
}

describe("bootstrap and session cookie", () => {
  let server: UiServer | undefined;
  let other: UiServer | undefined;

  afterEach(async () => {
    if (server) {
      await server.close();
      server = undefined;
    }
    if (other) {
      await other.close();
      other = undefined;
    }
  });

  it("redirects to / with a Set-Cookie on a valid token", async () => {
    server = await startUiServer({ port: 0, token: TOKEN, loader: stubLoader() });

    const response = await bootstrap(server.url, TOKEN);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/");
    expect(response.headers.get("set-cookie")).toContain(`verbatra_studio_${server.port}=`);
  });

  it("answers 401 on an invalid token, not an exception", async () => {
    server = await startUiServer({ port: 0, token: TOKEN, loader: stubLoader() });

    const response = await bootstrap(server.url, "wrong-token");

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("is idempotent: bootstrapping twice both succeed with 303 and a fresh Set-Cookie", async () => {
    server = await startUiServer({ port: 0, token: TOKEN, loader: stubLoader() });

    const first = await bootstrap(server.url, TOKEN);
    const second = await bootstrap(server.url, TOKEN);

    expect(first.status).toBe(303);
    expect(second.status).toBe(303);
    expect(first.headers.get("set-cookie")).not.toBeNull();
    expect(second.headers.get("set-cookie")).not.toBeNull();
  });

  it("re-authenticates on a valid token even when a stale cookie is already present", async () => {
    server = await startUiServer({ port: 0, token: TOKEN, loader: stubLoader() });
    const staleCookie = `verbatra_studio_${server.port}=stale-garbage-value`;

    const response = await fetch(`${server.url}?token=${TOKEN}`, {
      redirect: "manual",
      headers: { Cookie: staleCookie },
    });

    expect(response.status).toBe(303);
    expect(response.headers.get("set-cookie")).toContain(`verbatra_studio_${server.port}=`);
  });

  it("authenticates a request carrying its own valid cookie alongside a foreign-port cookie", async () => {
    server = await startUiServer({ port: 0, token: TOKEN, loader: stubLoader() });
    other = await startUiServer({
      port: 0,
      token: "other-server-token-9876543210abcdef",
      loader: stubLoader(),
    });

    const ownCookie = (await bootstrap(server.url, TOKEN)).headers.get("set-cookie")?.split(";")[0];
    const foreignCookie = (
      await bootstrap(other.url, "other-server-token-9876543210abcdef")
    ).headers
      .get("set-cookie")
      ?.split(";")[0];
    expect(ownCookie).toBeDefined();
    expect(foreignCookie).toBeDefined();

    const response = await fetch(server.url, {
      headers: { Cookie: `${foreignCookie}; ${ownCookie}` },
    });

    expect(response.status).not.toBe(401);
  });

  it("rejects a request carrying only a foreign-port cookie", async () => {
    server = await startUiServer({ port: 0, token: TOKEN, loader: stubLoader() });
    other = await startUiServer({
      port: 0,
      token: "other-server-token-9876543210abcdef",
      loader: stubLoader(),
    });

    const foreignCookie = (
      await bootstrap(other.url, "other-server-token-9876543210abcdef")
    ).headers
      .get("set-cookie")
      ?.split(";")[0];
    expect(foreignCookie).toBeDefined();

    const response = await fetch(server.url, { headers: { Cookie: foreignCookie ?? "" } });

    expect(response.status).toBe(401);
  });

  it("rejects a request with no cookie and no bootstrap token", async () => {
    server = await startUiServer({ port: 0, token: TOKEN, loader: stubLoader() });

    const response = await fetch(server.url);

    expect(response.status).toBe(401);
  });

  it("rejects a cookie with this server's own name but a wrong value, with no bootstrap token present", async () => {
    server = await startUiServer({ port: 0, token: TOKEN, loader: stubLoader() });
    const wrongValueCookie = `verbatra_studio_${server.port}=not-the-real-token`;

    const response = await fetch(server.url, { headers: { Cookie: wrongValueCookie } });

    expect(response.status).toBe(401);
  });
});
