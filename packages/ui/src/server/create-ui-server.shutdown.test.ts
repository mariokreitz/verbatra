import { connect } from "node:net";
import { describe, expect, it } from "vitest";
import { startUiServer } from "./create-ui-server.js";
import { stubLoader } from "./test-support.js";

describe("shutdown", () => {
  it("closes within 2 seconds even with an open keep-alive connection", async () => {
    const server = await startUiServer({ port: 0, loader: stubLoader() });

    const socket = connect(server.port, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", () => resolve());
      socket.once("error", reject);
    });
    // Send a request but leave the keep-alive connection open, as a browser tab would.
    socket.write(`GET / HTTP/1.1\r\nHost: 127.0.0.1:${server.port}\r\n\r\n`);
    await new Promise((resolve) => socket.once("data", resolve));

    const start = Date.now();
    await server.close();
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(2000);
    socket.destroy();
  }, 5000);
});
