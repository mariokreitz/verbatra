import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { FORBIDDEN_BODY, sendConstantResponse } from "./transport-responses.js";

describe("sendConstantResponse", () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
      server = undefined;
    }
  });

  it("writes the given status, a plain-text content type, no-store, and the constant body", async () => {
    server = createServer((_request, response) => {
      sendConstantResponse(response, 403, FORBIDDEN_BODY);
    });
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("expected a TCP address");
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/`);

    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.text()).resolves.toBe(FORBIDDEN_BODY);
  });
});
