const TAG_OPEN = "<";
const TAG_CLOSE = ">";
const CLOSING_SLASH = "/";

function isAsciiLetter(char: string | undefined): boolean {
  if (char === undefined) return false;
  return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z");
}

function tagEnd(text: string, open: number): number {
  const nameStart = text[open + 1] === CLOSING_SLASH ? open + 2 : open + 1;
  if (!isAsciiLetter(text[nameStart])) return -1;
  const close = text.indexOf(TAG_CLOSE, nameStart);
  return close === -1 ? text.length : close + 1;
}

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

export function plainAnswer(answer: string): string {
  let current = answer;
  for (;;) {
    const stripped = stripTagsOnce(current);
    if (stripped === current) return current;
    current = stripped;
  }
}
