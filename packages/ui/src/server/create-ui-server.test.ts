import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { startUiServer } from "./create-ui-server.js";
import { stubLoader } from "./test-support.js";
import type { UiServer } from "./types.js";

const TEST_TOKEN = "test-bootstrap-token-0123456789";

async function bootstrapCookie(url: string, token: string): Promise<string> {
  const response = await fetch(`${url}?token=${token}`, { redirect: "manual" });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie === null) {
    throw new Error("expected a Set-Cookie header from bootstrap");
  }
  return setCookie.split(";")[0] ?? "";
}

describe("startUiServer", () => {
  let server: UiServer | undefined;
  let assetsRootPath: string | undefined;

  afterEach(async () => {
    if (server) {
      await server.close();
      server = undefined;
    }
    if (assetsRootPath) {
      await rm(assetsRootPath, { recursive: true, force: true });
      assetsRootPath = undefined;
    }
  });

  it("serves the index page from an arbitrary temp assets root once authenticated", async () => {
    assetsRootPath = await mkdtemp(join(tmpdir(), "verbatra-ui-server-"));
    await writeFile(join(assetsRootPath, "index.html"), "<html>verbatra studio</html>");

    server = await startUiServer({
      port: 0,
      token: TEST_TOKEN,
      assetsRoot: pathToFileURL(`${assetsRootPath}/`),
      loader: stubLoader(),
    });
    const cookie = await bootstrapCookie(server.url, TEST_TOKEN);

    const response = await fetch(server.url, { headers: { Cookie: cookie } });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    await expect(response.text()).resolves.toBe("<html>verbatra studio</html>");
  });

  it("serves a nested asset with its matching content type once authenticated", async () => {
    assetsRootPath = await mkdtemp(join(tmpdir(), "verbatra-ui-server-"));
    await writeFile(join(assetsRootPath, "index.html"), "<html></html>");
    await writeFile(join(assetsRootPath, "app.js"), "console.log('hi');");

    server = await startUiServer({
      port: 0,
      token: TEST_TOKEN,
      assetsRoot: pathToFileURL(`${assetsRootPath}/`),
      loader: stubLoader(),
    });
    const cookie = await bootstrapCookie(server.url, TEST_TOKEN);

    const response = await fetch(new URL("app.js", server.url), { headers: { Cookie: cookie } });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(response.headers.get("cache-control")).not.toBe("no-store");
  });

  it("falls back to index.html for an unknown route (SPA-style) once authenticated", async () => {
    assetsRootPath = await mkdtemp(join(tmpdir(), "verbatra-ui-server-"));
    await writeFile(join(assetsRootPath, "index.html"), "<html>fallback</html>");

    server = await startUiServer({
      port: 0,
      token: TEST_TOKEN,
      assetsRoot: pathToFileURL(`${assetsRootPath}/`),
      loader: stubLoader(),
    });
    const cookie = await bootstrapCookie(server.url, TEST_TOKEN);

    const response = await fetch(new URL("some/deep/route", server.url), {
      headers: { Cookie: cookie },
    });

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("<html>fallback</html>");
  });

  it("returns 404 when neither the request nor index.html exist in the assets root", async () => {
    assetsRootPath = await mkdtemp(join(tmpdir(), "verbatra-ui-server-"));

    server = await startUiServer({
      port: 0,
      token: TEST_TOKEN,
      assetsRoot: pathToFileURL(`${assetsRootPath}/`),
      loader: stubLoader(),
    });
    const cookie = await bootstrapCookie(server.url, TEST_TOKEN);

    const response = await fetch(server.url, { headers: { Cookie: cookie } });

    expect(response.status).toBe(404);
  });

  it("binds to 127.0.0.1 and reports the actual bound port in the returned url", async () => {
    assetsRootPath = await mkdtemp(join(tmpdir(), "verbatra-ui-server-"));
    await writeFile(join(assetsRootPath, "index.html"), "<html></html>");

    server = await startUiServer({
      port: 0,
      assetsRoot: pathToFileURL(`${assetsRootPath}/`),
      loader: stubLoader(),
    });

    expect(server.url).toBe(`http://127.0.0.1:${server.port}/`);
    expect(server.port).toBeGreaterThan(0);
  });

  it("closes cleanly and stops accepting new connections", async () => {
    assetsRootPath = await mkdtemp(join(tmpdir(), "verbatra-ui-server-"));
    await writeFile(join(assetsRootPath, "index.html"), "<html></html>");

    const started = await startUiServer({
      port: 0,
      assetsRoot: pathToFileURL(`${assetsRootPath}/`),
      loader: stubLoader(),
    });
    await started.close();

    await expect(fetch(started.url)).rejects.toBeInstanceOf(Error);
  });

  it("falls back to the built assets next to this module when no override is given", async () => {
    server = await startUiServer({ port: 0, loader: stubLoader() });

    const response = await fetch(server.url);

    expect(response.status).toBe(401);
  });

  it("generates a token when none is given, and it authenticates the bootstrap flow", async () => {
    assetsRootPath = await mkdtemp(join(tmpdir(), "verbatra-ui-server-"));
    await writeFile(join(assetsRootPath, "index.html"), "<html></html>");
    let banner = "";

    server = await startUiServer({
      port: 0,
      assetsRoot: pathToFileURL(`${assetsRootPath}/`),
      output: (line) => {
        banner = line;
      },
      loader: stubLoader(),
    });
    const tokenMatch = /\?token=([0-9a-f]+)$/.exec(banner);
    expect(tokenMatch).not.toBeNull();
    const token = tokenMatch?.[1] ?? "";

    const cookie = await bootstrapCookie(server.url, token);
    const response = await fetch(server.url, { headers: { Cookie: cookie } });

    expect(response.status).toBe(200);
  });
});
