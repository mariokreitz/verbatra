import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SOURCE_PATH = fileURLToPath(new URL("./review-overlay.ts", import.meta.url));

/**
 * Static proof, mirroring `retranslate-entry.no-direct-env.test.ts`'s style, that the "actioned
 * this session" overlay never issues an RPC call or touches the network or a persisted browser
 * store: approve and reject (per acceptance criterion 13) are purely client-side, and this is the
 * direct structural proof, not merely an assumption about how the overlay happens to be wired
 * today.
 */
describe("static proof: the review overlay never dispatches an RPC call or a persisted store", () => {
  const content = readFileSync(SOURCE_PATH, "utf8");

  it("never references rpcClient or any RPC transport", () => {
    expect(content).not.toContain("rpcClient");
    expect(content).not.toContain("fetch(");
    expect(content).not.toContain("XMLHttpRequest");
    expect(content).not.toContain("EventSource");
  });

  it("never references sessionStorage or localStorage", () => {
    expect(content).not.toContain("sessionStorage");
    expect(content).not.toContain("localStorage");
  });

  it("declares no async function and no method returning a Promise", () => {
    expect(content).not.toContain("async ");
    expect(content).not.toContain("Promise<");
  });
});
