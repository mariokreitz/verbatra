import type { LoadedConfig } from "@verbatra/sdk";
import { describe, expect, it } from "vitest";
import { authenticatedCookie, baseUiConfig, withServer } from "./test-support.js";

const TOKEN = "rpc-lifecycle-test-token-0123456789abcdef";

async function postRpc(url: string, cookie: string, method: string): Promise<Response> {
  return fetch(new URL("/rpc", url), {
    method: "POST",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
      Origin: url.replace(/\/$/, ""),
    },
    body: JSON.stringify({ method, params: {} }),
  });
}

describe("config lifecycle (loader called once at startup)", () => {
  it("calls the injected loader exactly once at startup, regardless of how many RPC calls follow", async () => {
    let calls = 0;
    const loader = async (): Promise<LoadedConfig> => {
      calls += 1;
      return { config: baseUiConfig(), source: { kind: "override" }, glossary: { source: "none" } };
    };

    await withServer(
      async (server) => {
        const cookie = await authenticatedCookie(server.url, TOKEN);
        await postRpc(server.url, cookie, "project.snapshot");
        await postRpc(server.url, cookie, "project.snapshot");
        await postRpc(server.url, cookie, "status.check");
      },
      { token: TOKEN, loader },
    );

    expect(calls).toBe(1);
  });
});
