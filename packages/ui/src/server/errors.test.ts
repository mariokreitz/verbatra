import { describe, expect, it } from "vitest";
import { UiServerStartError } from "./errors.js";

describe("UiServerStartError", () => {
  it("carries a stable code and the port, with a fixed message", () => {
    const error = new UiServerStartError("PORT_IN_USE", 5849, "port 5849 is already in use");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("UiServerStartError");
    expect(error.code).toBe("PORT_IN_USE");
    expect(error.port).toBe(5849);
    expect(error.message).toBe("port 5849 is already in use");
  });
});
