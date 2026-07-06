import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { startUiServer } from "./create-ui-server.js";
import type { UiServer } from "./types.js";

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

  it("serves the index page from an arbitrary temp assets root passed as an override", async () => {
    assetsRootPath = await mkdtemp(join(tmpdir(), "verbatra-ui-server-"));
    await writeFile(join(assetsRootPath, "index.html"), "<html>verbatra studio</html>");

    server = await startUiServer({ assetsRoot: pathToFileURL(`${assetsRootPath}/`) });

    const response = await fetch(server.url);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    await expect(response.text()).resolves.toBe("<html>verbatra studio</html>");
  });

  it("serves a nested asset with its matching content type", async () => {
    assetsRootPath = await mkdtemp(join(tmpdir(), "verbatra-ui-server-"));
    await writeFile(join(assetsRootPath, "index.html"), "<html></html>");
    await writeFile(join(assetsRootPath, "app.js"), "console.log('hi');");

    server = await startUiServer({ assetsRoot: pathToFileURL(`${assetsRootPath}/`) });

    const response = await fetch(new URL("app.js", server.url));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
  });

  it("falls back to index.html for an unknown route (SPA-style)", async () => {
    assetsRootPath = await mkdtemp(join(tmpdir(), "verbatra-ui-server-"));
    await writeFile(join(assetsRootPath, "index.html"), "<html>fallback</html>");

    server = await startUiServer({ assetsRoot: pathToFileURL(`${assetsRootPath}/`) });

    const response = await fetch(new URL("some/deep/route", server.url));

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("<html>fallback</html>");
  });

  it("returns 404 when neither the request nor index.html exist in the assets root", async () => {
    assetsRootPath = await mkdtemp(join(tmpdir(), "verbatra-ui-server-"));

    server = await startUiServer({ assetsRoot: pathToFileURL(`${assetsRootPath}/`) });

    const response = await fetch(server.url);

    expect(response.status).toBe(404);
  });

  it("binds to 127.0.0.1 and reports the actual bound port in the returned url", async () => {
    assetsRootPath = await mkdtemp(join(tmpdir(), "verbatra-ui-server-"));
    await writeFile(join(assetsRootPath, "index.html"), "<html></html>");

    server = await startUiServer({ assetsRoot: pathToFileURL(`${assetsRootPath}/`) });

    expect(server.url).toBe(`http://127.0.0.1:${server.port}/`);
    expect(server.port).toBeGreaterThan(0);
  });

  it("closes cleanly and stops accepting new connections", async () => {
    assetsRootPath = await mkdtemp(join(tmpdir(), "verbatra-ui-server-"));
    await writeFile(join(assetsRootPath, "index.html"), "<html></html>");

    const started = await startUiServer({ assetsRoot: pathToFileURL(`${assetsRootPath}/`) });
    await started.close();

    await expect(fetch(started.url)).rejects.toBeInstanceOf(Error);
  });

  it("falls back to the built assets next to this module when no override is given", async () => {
    server = await startUiServer({});

    const response = await fetch(server.url);

    expect(response.status).toBe(404);
  });
});
