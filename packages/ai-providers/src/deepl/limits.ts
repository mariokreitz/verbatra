export const DEEPL_MAX_TEXTS_PER_REQUEST = 50;

const DEEPL_MAX_PAYLOAD_BYTES = 128 * 1024;
const DEEPL_PAYLOAD_OVERHEAD_RESERVE_BYTES = 4 * 1024;

export const DEEPL_MAX_TEXT_PAYLOAD_BYTES =
  DEEPL_MAX_PAYLOAD_BYTES - DEEPL_PAYLOAD_OVERHEAD_RESERVE_BYTES;

function estimateWireBytes(text: string): number {
  return encodeURIComponent(text).length;
}

export function chunkTextsForDeepL(texts: readonly string[]): readonly string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let currentBytes = 0;

  for (const text of texts) {
    const textBytes = estimateWireBytes(text);
    const startsNewChunk =
      current.length > 0 &&
      (current.length >= DEEPL_MAX_TEXTS_PER_REQUEST ||
        currentBytes + textBytes > DEEPL_MAX_TEXT_PAYLOAD_BYTES);
    if (startsNewChunk) {
      chunks.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(text);
    currentBytes += textBytes;
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks;
}
