import type { ReactNode } from "react";

/** A small, shared loading indicator every panel uses while its first rpc call is in flight. */
export function Loading(): ReactNode {
  return <p>Loading...</p>;
}
