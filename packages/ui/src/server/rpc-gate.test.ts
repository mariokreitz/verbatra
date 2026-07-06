import { describe, expect, it } from "vitest";
import { handleRpcBody } from "./rpc-gate.js";

describe("handleRpcBody", () => {
  it("answers a constant not-implemented result regardless of the body", async () => {
    const result = await handleRpcBody(Buffer.from('{"method":"status.check"}'));

    expect(result.statusCode).toBe(501);
    expect(result.body).toBe("Not Implemented");
  });
});
