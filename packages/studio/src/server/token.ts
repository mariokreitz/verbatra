import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_BYTES = 32;

export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("hex");
}

function hashToken(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function tokensMatch(candidate: string, stored: string): boolean {
  return timingSafeEqual(hashToken(candidate), hashToken(stored));
}
