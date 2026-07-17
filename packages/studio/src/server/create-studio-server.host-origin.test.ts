import { connect } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { startStudioServer } from "./create-studio-server.js";
import { stubLoader } from "./test-support.js";
import type { StudioServer } from "./types.js";

interface RawResponse {
  readonly status: number;
  readonly headers: Record<string, string>;
}

/**
 * Sends a handcrafted HTTP/1.1 request over a raw socket so tests can set (or omit) headers that
 * fetch will not let a caller control, such as Host, or send no Host header at all.
 */
function rawRequest(
  port: number,
  requestLine: string,
  headerLines: string[],
  body = "",
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const socket = connect(port, "127.0.0.1", () => {
      const lines = [requestLine, ...headerLines, "Connection: close", "", body];
      socket.write(lines.join("\r\n"));
    });
    let raw = "";
    socket.on("data", (chunk: Buffer) => {
      raw += chunk.toString("utf8");
    });
    socket.on("end", () => {
      const [head] = raw.split("\r\n\r\n");
      const headerLinesReceived = (head ?? "").split("\r\n");
      const statusMatch = /^HTTP\/1\.1 (\d+)/.exec(headerLinesReceived[0] ?? "");
      const status = statusMatch?.[1] !== undefined ? Number(statusMatch[1]) : 0;
      const headers: Record<string, string> = {};
      for (const line of headerLinesReceived.slice(1)) {
        const separatorIndex = line.indexOf(":");
        if (separatorIndex !== -1) {
          headers[line.slice(0, separatorIndex).toLowerCase().trim()] = line
            .slice(separatorIndex + 1)
            .trim();
        }
      }
      resolve({ status, headers });
    });
    socket.on("error", reject);
  });
}

describe("Host and Origin gate", () => {
  let server: StudioServer | undefined;

  afterEach(async () => {
    if (server) {
      await server.close();
      server = undefined;
    }
  });

  it("accepts Host 127.0.0.1:<actual port>, reaching the authentication check beyond it", async () => {
    server = await startStudioServer({ port: 0, loader: stubLoader() });

    const response = await rawRequest(server.port, "GET / HTTP/1.1", [
      `Host: 127.0.0.1:${server.port}`,
    ]);

    expect(response.status).toBe(401);
  });

  it("rejects Host localhost:<port> with the constant 403 body", async () => {
    server = await startStudioServer({ port: 0, loader: stubLoader() });

    const response = await rawRequest(server.port, "GET / HTTP/1.1", [
      `Host: localhost:${server.port}`,
    ]);

    expect(response.status).toBe(403);
  });

  it("rejects Host [::1]:<port> with the constant 403 body", async () => {
    server = await startStudioServer({ port: 0, loader: stubLoader() });

    const response = await rawRequest(server.port, "GET / HTTP/1.1", [
      `Host: [::1]:${server.port}`,
    ]);

    expect(response.status).toBe(403);
  });

  it("rejects an empty Host header value", async () => {
    server = await startStudioServer({ port: 0, loader: stubLoader() });

    const response = await rawRequest(server.port, "GET / HTTP/1.1", ["Host:"]);

    expect(response.status).toBe(403);
  });

  it("rejects a request with no Host header at all", async () => {
    server = await startStudioServer({ port: 0, loader: stubLoader() });

    const response = await rawRequest(server.port, "GET / HTTP/1.1", []);

    expect(response.status).toBe(400);
  });

  it("rejects a Host header with the wrong port", async () => {
    server = await startStudioServer({ port: 0, loader: stubLoader() });

    const response = await rawRequest(server.port, "GET / HTTP/1.1", [
      `Host: 127.0.0.1:${server.port + 1}`,
    ]);

    expect(response.status).toBe(403);
  });

  it("rejects Host 127.0.0.1:0 when the server is bound on a non-zero ephemeral port", async () => {
    server = await startStudioServer({ port: 0, loader: stubLoader() });
    expect(server.port).not.toBe(0);

    const response = await rawRequest(server.port, "GET / HTTP/1.1", ["Host: 127.0.0.1:0"]);

    expect(response.status).toBe(403);
  });

  it("allows an absent Origin on POST, reaching the path check beyond it", async () => {
    server = await startStudioServer({ port: 0, loader: stubLoader() });

    const response = await rawRequest(
      server.port,
      "POST /not-rpc HTTP/1.1",
      [`Host: 127.0.0.1:${server.port}`, "Content-Length: 0"],
      "",
    );

    expect(response.status).toBe(404);
  });

  it("allows a matching Origin on POST, reaching the path check beyond it", async () => {
    server = await startStudioServer({ port: 0, loader: stubLoader() });

    const response = await rawRequest(
      server.port,
      "POST /not-rpc HTTP/1.1",
      [
        `Host: 127.0.0.1:${server.port}`,
        `Origin: http://127.0.0.1:${server.port}`,
        "Content-Length: 0",
      ],
      "",
    );

    expect(response.status).toBe(404);
  });

  it("rejects the literal null Origin on POST", async () => {
    server = await startStudioServer({ port: 0, loader: stubLoader() });

    const response = await rawRequest(
      server.port,
      "POST /not-rpc HTTP/1.1",
      [`Host: 127.0.0.1:${server.port}`, "Origin: null", "Content-Length: 0"],
      "",
    );

    expect(response.status).toBe(403);
  });

  it("rejects a foreign Origin on POST", async () => {
    server = await startStudioServer({ port: 0, loader: stubLoader() });

    const response = await rawRequest(
      server.port,
      "POST /not-rpc HTTP/1.1",
      [`Host: 127.0.0.1:${server.port}`, "Origin: http://evil.example", "Content-Length: 0"],
      "",
    );

    expect(response.status).toBe(403);
  });

  it("always rejects OPTIONS with the constant 403 body, even with a valid Host", async () => {
    server = await startStudioServer({ port: 0, loader: stubLoader() });

    const response = await rawRequest(server.port, "OPTIONS / HTTP/1.1", [
      `Host: 127.0.0.1:${server.port}`,
    ]);

    expect(response.status).toBe(403);
  });

  it("never sends an Access-Control-* header on any response", async () => {
    server = await startStudioServer({ port: 0, loader: stubLoader() });

    const responses = await Promise.all([
      rawRequest(server.port, "GET / HTTP/1.1", [`Host: 127.0.0.1:${server.port}`]),
      rawRequest(server.port, "OPTIONS / HTTP/1.1", [`Host: 127.0.0.1:${server.port}`]),
      rawRequest(
        server.port,
        "POST /rpc HTTP/1.1",
        [`Host: 127.0.0.1:${server.port}`, "Content-Length: 0"],
        "",
      ),
      rawRequest(server.port, "GET / HTTP/1.1", [`Host: localhost:${server.port}`]),
    ]);

    for (const response of responses) {
      const acHeader = Object.keys(response.headers).find((name) =>
        name.startsWith("access-control-"),
      );
      expect(acHeader).toBeUndefined();
    }
  });
});
