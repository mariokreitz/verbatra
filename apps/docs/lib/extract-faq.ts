import type { FaqItem } from "@/lib/structured-data";

/**
 * Strips the trailing Fumadocs anchor suffix from a heading line, for
 * example "How do I control cost? [#how-do-i-control-cost]".
 */
function headingText(line: string): string {
  return line
    .replace(/^##\s+/, "")
    .replace(/\s*\[#[^\]]*\]\s*$/, "")
    .trim();
}

/**
 * Reduces a markdown fragment to plain text suitable for a JSON-LD answer:
 * links become their label, inline code loses its backticks, list bullets
 * become plain hyphens, and whitespace is collapsed.
 */
function plainText(markdown: string): string {
  return markdown
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`/g, "")
    .replace(/^\s*[*-]\s+/gm, "- ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts question and answer pairs from the FAQ page's markdown, where
 * every H2 heading is a question and the section body below it is the
 * answer. Returns an empty array when the content has no H2 sections, so
 * callers can skip emitting an FAQPage block instead of fabricating one.
 */
export function extractFaqItems(markdown: string): FaqItem[] {
  const items: FaqItem[] = [];
  const sections = markdown.split(/^(?=## )/m);
  for (const section of sections) {
    if (!section.startsWith("## ")) continue;
    const newlineIndex = section.indexOf("\n");
    if (newlineIndex === -1) continue;
    const question = headingText(section.slice(0, newlineIndex));
    const answer = plainText(section.slice(newlineIndex + 1));
    if (question.length > 0 && answer.length > 0) items.push({ question, answer });
  }
  return items;
}
