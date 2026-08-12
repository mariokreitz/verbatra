import { describe, expect, it } from "vitest";
import { extractFaqItems } from "./extract-faq";

describe("extractFaqItems", () => {
  it("returns an empty array for empty content", () => {
    expect(extractFaqItems("")).toEqual([]);
  });

  it("returns an empty array when the content has no H2 sections", () => {
    expect(extractFaqItems("Just a paragraph, no heading.\n")).toEqual([]);
  });

  it("extracts a question and answer pair from each H2 section", () => {
    const markdown = [
      "## What is verbatra? [#what-is-verbatra]",
      "verbatra is a tool.",
      "",
      "## How do I install it?",
      "Run `npm i -D @verbatra/cli` to install.",
      "",
    ].join("\n");

    expect(extractFaqItems(markdown)).toEqual([
      { question: "What is verbatra?", answer: "verbatra is a tool." },
      { question: "How do I install it?", answer: "Run npm i -D @verbatra/cli to install." },
    ]);
  });

  it("strips the Fumadocs anchor suffix from an anchored heading", () => {
    const markdown = "## Some question? [#some-question]\nAn answer.\n";
    expect(extractFaqItems(markdown)[0]?.question).toBe("Some question?");
  });

  it("resolves links, inline code, and bullets in the answer to plain text", () => {
    const markdown = [
      "## Reference [#reference]",
      "See the [config guide](/docs/config-file) and run `verbatra diff`.",
      "",
      "* item one",
      "* item two",
      "",
    ].join("\n");

    expect(extractFaqItems(markdown)).toEqual([
      {
        question: "Reference",
        answer: "See the config guide and run verbatra diff. - item one - item two",
      },
    ]);
  });

  it("skips a heading with no body text", () => {
    const markdown = "## Empty section\n## Real question\nReal answer.\n";
    expect(extractFaqItems(markdown)).toEqual([
      { question: "Real question", answer: "Real answer." },
    ]);
  });

  it("skips a heading with no trailing newline", () => {
    expect(extractFaqItems("## Just a heading")).toEqual([]);
  });
});
