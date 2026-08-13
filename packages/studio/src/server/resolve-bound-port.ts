import type { AddressInfo } from "node:net";

export function resolveBoundAddress(address: AddressInfo | string | null): AddressInfo {
  if (address === null || typeof address === "string") {
    throw new Error("verbatra studio server failed to bind a TCP address");
  }
  return address;
}

export function resolveBoundPort(address: AddressInfo | string | null): number {
  return resolveBoundAddress(address).port;
}
