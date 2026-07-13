/** DeepL's documented per-request cap on the number of texts in one translateText call. */
export const DEEPL_MAX_TEXTS_PER_REQUEST = 50;

/**
 * DeepL's documented per-request payload cap, in bytes. A conservative fraction of the documented
 * 128 KiB is reserved as headroom for the request's non-text overhead (the source/target language
 * fields, options, and form-encoding framing DeepL counts against the same cap), so a chunk sized to
 * this budget stays under the real limit even though only text bytes are summed here.
 */
const DEEPL_MAX_PAYLOAD_BYTES = 128 * 1024;
const DEEPL_PAYLOAD_OVERHEAD_RESERVE_BYTES = 4 * 1024;
export const DEEPL_MAX_TEXT_PAYLOAD_BYTES =
  DEEPL_MAX_PAYLOAD_BYTES - DEEPL_PAYLOAD_OVERHEAD_RESERVE_BYTES;

/**
 * deepl-node posts texts as `application/x-www-form-urlencoded`, which percent-encodes every non-ASCII
 * byte to 3 wire bytes (`%XX`). Measuring raw UTF-8 byte length would under-count the actual request
 * size for CJK, Cyrillic, Arabic, and similar text, letting a chunk pass the budget check and still
 * exceed DeepL's real cap on the wire. `encodeURIComponent` is a close proxy for that inflation, not a
 * guaranteed upper bound in every direction (it leaves a few punctuation characters unescaped that real
 * form encoding does percent-encode); the 4 KiB overhead reserve above is the actual safety margin, and
 * an underestimate here fails as a clear DeepL 400, not silent corruption.
 */
function estimateWireBytes(text: string): number {
  return encodeURIComponent(text).length;
}

/**
 * Split texts into sequential chunks, each within DeepL's per-request caps: at most
 * {@link DEEPL_MAX_TEXTS_PER_REQUEST} texts and {@link DEEPL_MAX_TEXT_PAYLOAD_BYTES} of combined
 * estimated wire bytes (see {@link estimateWireBytes}). A single text that alone exceeds the byte
 * budget is still placed in its own chunk (it cannot be split further without corrupting the string);
 * every other chunk stays within both caps.
 *
 * @param texts - The ordered texts to send to DeepL.
 * @returns Ordered chunks that, concatenated in order, reproduce `texts`.
 */
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
