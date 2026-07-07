import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { applyNoStore, applySecurityHeaders, CONTENT_SECURITY_POLICY } from "./security-headers.js";

describe("applySecurityHeaders and applyNoStore", () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
      server = undefined;
    }
  });

  it("sets the fixed headers on a real response and never a CORS header", async () => {
    server = createServer((_request, response) => {
      applySecurityHeaders(response);
      applyNoStore(response);
      response.end("ok");
    });
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("expected a TCP address");
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/`);

    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("content-security-policy")).toBe(CONTENT_SECURITY_POLICY);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("pins the exact CSP string with no unsafe-inline or unsafe-eval", () => {
    expect(CONTENT_SECURITY_POLICY).not.toContain("unsafe-inline");
    expect(CONTENT_SECURITY_POLICY).not.toContain("unsafe-eval");
    expect(CONTENT_SECURITY_POLICY).toBe(
      "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
  });
});
