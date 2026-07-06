import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { assertLoopbackAddress, startUiServer } from "./create-ui-server.js";
import { UiServerStartError } from "./errors.js";
import { stubLoader } from "./test-support.js";
import type { UiServer } from "./types.js";

describe("assertLoopbackAddress", () => {
  it("does not throw for the loopback address", () => {
    expect(() =>
      assertLoopbackAddress({ address: "127.0.0.1", family: "IPv4", port: 5849 }),
    ).not.toThrow();
  });

  it("throws a structured error for any other bound address", () => {
    expect(() => assertLoopbackAddress({ address: "0.0.0.0", family: "IPv4", port: 5849 })).toThrow(
      UiServerStartError,
    );
  });
});

describe("startUiServer failure modes", () => {
  let first: UiServer | undefined;
  let second: UiServer | undefined;

  afterEach(async () => {
    if (first) {
      await first.close();
      first = undefined;
    }
    if (second) {
      await second.close();
      second = undefined;
    }
  });

  it("surfaces EADDRINUSE as a structured, catchable error and never falls back to another port", async () => {
    first = await startUiServer({ port: 0, loader: stubLoader() });

    await expect(startUiServer({ port: first.port, loader: stubLoader() })).rejects.toMatchObject({
      name: "UiServerStartError",
      code: "PORT_IN_USE",
      port: first.port,
    });
  });
});

describe("malformed request handling", () => {
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

  it("answers the constant 403 body for a request the HTTP parser itself rejects", async () => {
    server = await startUiServer({ port: 0, loader: stubLoader() });

    const raw = await new Promise<string>((resolve, reject) => {
      const socket = connect(server?.port ?? 0, "127.0.0.1", () => {
        socket.write("GARBAGE REQUEST LINE\r\n\r\n");
      });
      let response = "";
      socket.on("data", (chunk: Buffer) => {
        response += chunk.toString("utf8");
      });
      socket.on("end", () => resolve(response));
      socket.on("error", reject);
    });

    expect(raw).toContain("403 Forbidden");
    expect(raw).toContain("Forbidden");
  });

  it("stays responsive after an authenticated request whose body is aborted mid-upload", async () => {
    assetsRootPath = await mkdtemp(join(tmpdir(), "verbatra-ui-server-"));
    await writeFile(join(assetsRootPath, "index.html"), "<html>still here</html>");
    const token = "aborted-upload-test-token-0123456789";
    server = await startUiServer({
      port: 0,
      token,
      assetsRoot: pathToFileURL(`${assetsRootPath}/`),
      loader: stubLoader(),
    });
    const port = server.port;

    const setCookie = (
      await fetch(`${server.url}?token=${token}`, { redirect: "manual" })
    ).headers.get("set-cookie");
    const cookie = setCookie?.split(";")[0];
    expect(cookie).toBeDefined();

    // With a valid cookie and a correct content type, this request passes every gate ahead of the
    // body read (Origin, path, auth, content type) and only fails once the body itself is read,
    // which is the code path this test exercises.
    await new Promise<void>((resolve, reject) => {
      const socket = connect(port, "127.0.0.1", () => {
        socket.write(
          `POST /rpc HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nCookie: ${cookie}\r\nContent-Type: application/json\r\nContent-Length: 1000\r\n\r\n`,
        );
        socket.write("{");
        // Aborts the connection mid-body instead of sending the declared 1000 bytes.
        socket.destroy();
      });
      socket.on("close", () => resolve());
      socket.on("error", reject);
    });

    const response = await fetch(server.url, { headers: { Cookie: cookie ?? "" } });
    expect(response.status).toBe(200);
  });
});
