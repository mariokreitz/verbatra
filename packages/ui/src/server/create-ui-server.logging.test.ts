import { afterEach, describe, expect, it } from "vitest";
import { startUiServer } from "./create-ui-server.js";
import { stubLoader } from "./test-support.js";
import type { UiServer } from "./types.js";

describe("token-once banner and request logging", () => {
  let server: UiServer | undefined;

  afterEach(async () => {
    if (server) {
      await server.close();
      server = undefined;
    }
  });

  it("prints the token exactly once, in the startup banner, and never in a request log line", async () => {
    const lines: string[] = [];

    server = await startUiServer({
      port: 0,
      output: (line) => lines.push(line),
      loader: stubLoader(),
    });
    const bannerLine = lines[0] ?? "";
    const tokenMatch = /\?token=([0-9a-f]+)$/.exec(bannerLine);
    expect(tokenMatch).not.toBeNull();
    const token = tokenMatch?.[1] ?? "";
    expect(token.length).toBeGreaterThanOrEqual(32);

    const cookie = (
      await fetch(`${server.url}?token=${token}`, { redirect: "manual" })
    ).headers.get("set-cookie");
    await fetch(server.url, { headers: { Cookie: cookie?.split(";")[0] ?? "" } });
    await fetch(new URL("missing-asset.js", server.url), {
      headers: { Cookie: cookie?.split(";")[0] ?? "" },
    });

    const occurrences = lines.filter((line) => line.includes(token)).length;
    expect(occurrences).toBe(1);

    const requestLines = lines.slice(1);
    expect(requestLines.length).toBeGreaterThan(0);
    for (const line of requestLines) {
      expect(line).not.toContain("token");
      expect(line).not.toContain("?");
    }
  });

  it("logs the method, the path without a query string, and the status", async () => {
    const lines: string[] = [];
    server = await startUiServer({
      port: 0,
      output: (line) => lines.push(line),
      loader: stubLoader(),
    });

    await fetch(new URL("/some/path?with=query", server.url));

    const requestLine = lines.find((line) => line.startsWith("GET /some/path"));
    expect(requestLine).toBe("GET /some/path 401");
  });
});
