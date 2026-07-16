import { createServer, type Server } from "node:http";
import { connect } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { BODY_CAP_BYTES, PayloadTooLargeError, readBodyWithCap } from "./body-reader.js";

const SMALL_CAP = 16;

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("expected a TCP address");
  }
  return address.port;
}

describe("readBodyWithCap", () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
      server = undefined;
    }
  });

  it("resolves with the full body when it is within the cap", async () => {
    server = createServer((request, response) => {
      void readBodyWithCap(request, BODY_CAP_BYTES).then((body) => {
        response.end(body.length.toString());
      });
    });
    const port = await listen(server);

    const response = await fetch(`http://127.0.0.1:${port}/`, { method: "POST", body: "hello" });

    await expect(response.text()).resolves.toBe("5");
  });

  it("rejects immediately when Content-Length declares more than the cap, without reading the body", async () => {
    server = createServer((request, response) => {
      void readBodyWithCap(request, SMALL_CAP).then(
        () => response.end("read"),
        (error: unknown) => {
          response.statusCode = error instanceof PayloadTooLargeError ? 413 : 500;
          response.end();
        },
      );
    });
    const port = await listen(server);

    const response = await fetch(`http://127.0.0.1:${port}/`, {
      method: "POST",
      body: "x".repeat(SMALL_CAP + 1),
    });

    expect(response.status).toBe(413);
  });

  it("destroys the connection once streamed bytes cross the cap even without a truthful Content-Length", async () => {
    server = createServer((request, response) => {
      void readBodyWithCap(request, SMALL_CAP).then(
        () => response.end("read"),
        (error: unknown) => {
          if (error instanceof PayloadTooLargeError) {
            request.socket.destroy();
          }
        },
      );
    });
    const port = await listen(server);

    const socketClosed = await new Promise<boolean>((resolve) => {
      const socket = connect(port, "127.0.0.1", () => {
        socket.write(
          "POST / HTTP/1.1\r\nHost: 127.0.0.1\r\nTransfer-Encoding: chunked\r\nConnection: keep-alive\r\n\r\n",
        );
        const chunk = "a".repeat(4);
        for (let index = 0; index < SMALL_CAP; index += 1) {
          socket.write(`${chunk.length.toString(16)}\r\n${chunk}\r\n`);
        }
      });
      socket.on("close", () => resolve(true));
      socket.on("error", () => resolve(true));
      setTimeout(() => resolve(false), 2000);
    });

    expect(socketClosed).toBe(true);
  });
});
