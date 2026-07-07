import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** 32 bytes (256 bits) of randomness, well above the 128-bit floor. */
const TOKEN_BYTES = 32;

/** Generates a fresh bootstrap token as a hex string. */
export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

function hashToken(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/**
 * Compares a candidate (a query token or a cookie value) against the server's token. Both sides
 * are hashed to a fixed-size digest first, so a candidate of any length compares in constant time
 * against the stored token and can never throw on a length mismatch; a non-matching or
 * wrong-length candidate simply fails the comparison.
 */
export function tokensMatch(candidate: string, stored: string): boolean {
  return timingSafeEqual(hashToken(candidate), hashToken(stored));
}
