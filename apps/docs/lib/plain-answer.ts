/**
 * Reduces a FAQ answer to prose by removing the markup it carries for the UI.
 *
 * Answers are ICU rich text: the landing accordion renders them through `t.rich`, which turns a
 * word such as the changelog into a link. The JSON-LD `acceptedAnswer.text` must be the prose
 * alone, so the markup is removed before the answer reaches the structured data.
 *
 * Two properties matter more than the stripping itself, and the first version of this file had
 * neither. A single pass of a tag-shaped regular expression is not idempotent: removing an inner
 * tag can leave the two halves of an outer one adjacent, so `<<b>script>` became `<script>`. And a
 * pattern that demands `>` right after the tag name never matches a tag carrying an attribute, so
 * that tag passed through whole. This module therefore scans characters rather than matching a
 * pattern, and repeats the scan until the text stops changing.
 *
 * @packageDocumentation
 */

const TAG_OPEN = "<";
const TAG_CLOSE = ">";
const CLOSING_SLASH = "/";

/** Whether the character is an ASCII letter, the only thing an element name may start with. */
function isAsciiLetter(char: string | undefined): boolean {
  if (char === undefined) return false;
  return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z");
}

/**
 * The index just past the tag opening at `open`, or -1 when nothing there is a tag.
 *
 * A tag is `<`, an optional `/`, and an ASCII letter. Everything up to and including the next `>`
 * belongs to it, whatever attributes it holds. A tag that is never closed runs to the end of the
 * answer and is removed with it, so a truncated `<script` cannot survive as text.
 */
function tagEnd(text: string, open: number): number {
  const nameStart = text[open + 1] === CLOSING_SLASH ? open + 2 : open + 1;
  if (!isAsciiLetter(text[nameStart])) return -1;
  const close = text.indexOf(TAG_CLOSE, nameStart);
  return close === -1 ? text.length : close + 1;
}

/**
 * One left to right pass that copies the text and drops every tag it meets.
 *
 * An angle bracket that opens nothing (`under < 10`, or a malformed `</ b>`) is prose and is
 * copied through. Because the pass never re-reads what it has already written, a copied `<` can
 * end up next to text that a later removal pulled towards it, which is exactly the reassembly the
 * caller's loop exists to catch.
 */
function stripTagsOnce(text: string): string {
  let output = "";
  let index = 0;
  while (index < text.length) {
    const open = text.indexOf(TAG_OPEN, index);
    if (open === -1) return output + text.slice(index);
    output += text.slice(index, open);
    const end = tagEnd(text, open);
    if (end === -1) {
      output += TAG_OPEN;
      index = open + 1;
      continue;
    }
    index = end;
  }
  return output;
}

/**
 * Strips the rich-text markup from a FAQ answer, leaving the prose that was inside it.
 *
 * The scan repeats until a pass changes nothing. Every pass that does change the answer deletes at
 * least the two characters of a tag opening, so the loop always ends, and it ends only in a state
 * where no pass would remove anything: no `<` in the result is followed by a letter or by `/` and
 * a letter. Markup cannot be reassembled out of what is left, and `<script` in particular cannot
 * appear. An answer with no markup is returned unchanged.
 */
export function plainAnswer(answer: string): string {
  let current = answer;
  for (;;) {
    const stripped = stripTagsOnce(current);
    if (stripped === current) return current;
    current = stripped;
  }
}
