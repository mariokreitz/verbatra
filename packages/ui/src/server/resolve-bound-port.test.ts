import { describe, expect, it } from "vitest";
import { resolveBoundPort } from "./resolve-bound-port.js";

describe("resolveBoundPort", () => {
  it("returns the port from an AddressInfo", () => {
    expect(resolveBoundPort({ address: "127.0.0.1", family: "IPv4", port: 5849 })).toBe(5849);
  });

  it("throws when the address is null (not yet bound)", () => {
    expect(() => resolveBoundPort(null)).toThrow("verbatra ui server failed to bind a TCP address");
  });

  it("throws when the address is a string (a pipe or Unix socket)", () => {
    expect(() => resolveBoundPort("/tmp/verbatra-ui.sock")).toThrow(
      "verbatra ui server failed to bind a TCP address",
    );
  });
});
