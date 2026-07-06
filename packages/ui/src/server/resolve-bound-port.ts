import type { AddressInfo } from "node:net";

/**
 * Extracts the actual bound TCP port from `server.address()`. A `net.Server` reports `null` before
 * listening and a string for a Unix socket or named pipe; neither applies here since the server
 * always binds a TCP port, so either case is an unexpected failure to bind.
 */
export function resolveBoundPort(address: AddressInfo | string | null): number {
  if (address === null || typeof address === "string") {
    throw new Error("verbatra ui server failed to bind a TCP address");
  }
  return address.port;
}
