import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AI_SETUP_PROMPT } from "./ai-setup-prompt";

const MDX_PATH = fileURLToPath(
  new URL("../content/docs/(guides)/start-with-ai.mdx", import.meta.url),
);
const TEXT_FENCE = /```text\n([\s\S]*?)```/;

describe("AI_SETUP_PROMPT", () => {
  it("matches the fenced prompt in start-with-ai.mdx verbatim", () => {
    const mdx = readFileSync(MDX_PATH, "utf-8");
    const match = mdx.match(TEXT_FENCE);
    expect(match).not.toBeNull();
    expect(AI_SETUP_PROMPT).toBe(match?.[1]);
  });
});
