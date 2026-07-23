const FNV_OFFSET_BASIS = 14695981039346656037n;
const FNV_PRIME = 1099511628211n;
const U64_MASK = (1n << 64n) - 1n;

/**
 * Deterministic 64-bit FNV-1a hash of a string, returned as 16 lowercase hex chars. A pure,
 * dependency-free digest for turning any canonical string into a short, stable key. Not a
 * cryptographic hash: it is a fast content fingerprint, safe only for equality and change
 * detection, never for security.
 *
 * @param input - The string to hash.
 * @returns A 16-character lowercase hex digest.
 */
export function stableStringHash(input: string): string {
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= BigInt(input.charCodeAt(index));
    hash = (hash * FNV_PRIME) & U64_MASK;
  }
  return hash.toString(16).padStart(16, "0");
}
