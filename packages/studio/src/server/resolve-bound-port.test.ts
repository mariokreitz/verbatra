import { describe, expect, it } from "vitest";
import { resolveBoundAddress, resolveBoundPort } from "./resolve-bound-port.js";

describe("resolveBoundPort", () => {
  it("returns the port from an AddressInfo", () => {
    expect(resolveBoundPort({ address: "127.0.0.1", family: "IPv4", port: 5849 })).toBe(5849);
  });

  it("throws when the address is null (not yet bound)", () => {
    expect(() => resolveBoundPort(null)).toThrow(
      "verbatra studio server failed to bind a TCP address",
    );
  });

  it("throws when the address is a string (a pipe or Unix socket)", () => {
    expect(() => resolveBoundPort("/tmp/verbatra-studio.sock")).toThrow(
      "verbatra studio server failed to bind a TCP address",
    );
  });
});

describe("resolveBoundAddress", () => {
  it("returns the AddressInfo unchanged", () => {
    const address = { address: "127.0.0.1", family: "IPv4", port: 5849 };
    expect(resolveBoundAddress(address)).toBe(address);
  });

  it("throws when the address is null", () => {
    expect(() => resolveBoundAddress(null)).toThrow(
      "verbatra studio server failed to bind a TCP address",
    );
  });

  it("throws when the address is a string", () => {
    expect(() => resolveBoundAddress("/tmp/verbatra-studio.sock")).toThrow(
      "verbatra studio server failed to bind a TCP address",
    );
  });
});
