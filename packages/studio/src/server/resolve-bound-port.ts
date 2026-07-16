import type { AddressInfo } from "node:net";

/**
 * Extracts the bound TCP address from a `server.address()` result. A `net.Server` reports `null`
 * before listening and a string for a Unix socket or named pipe; the studio server always binds
 * a TCP port, so either case is an unexpected failure to bind.
 *
 * @throws An `Error` when the address is `null` or a string.
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
