import type { AddressInfo } from "node:net";

/**
 * Extracts the actual bound TCP address from `server.address()`. A `net.Server` reports `null`
 * before listening and a string for a Unix socket or named pipe; neither applies here since the
 * server always binds a TCP port, so either case is an unexpected failure to bind.
 */
export function resolveBoundAddress(address: AddressInfo | string | null): AddressInfo {
  if (address === null || typeof address === "string") {
    throw new Error("verbatra studio server failed to bind a TCP address");
  }
  return address;
}

/** Extracts just the bound port; see {@link resolveBoundAddress} for the failure cases. */
export function resolveBoundPort(address: AddressInfo | string | null): number {
  return resolveBoundAddress(address).port;
}
