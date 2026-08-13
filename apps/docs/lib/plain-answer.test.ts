import { describe, expect, it } from "vitest";
import { plainAnswer } from "./plain-answer";

const ALL_INPUTS = [
  "Pin a version and read the changelog when you upgrade.",
  "Pin a version and read the <releases>changelog</releases> when you upgrade.",
  'Read the <a href="https://example.test" onmouseover="x()">changelog</a>.',
  "<img src=x onerror=doSomething()>The rest of the answer.",
  "<<b>script>doSomething()<</b>/script>",
  "<scr<b></b>ipt>doSomething()",
  "</<b>script>",
  "An answer that ends in an unclosed <script tag",
  "A malformed </ b> closing bracket.",
  "Keys under < 10 and over > 5 are counted separately.",
  "",
];

describe("plainAnswer", () => {
  it("leaves an answer without markup byte for byte unchanged", () => {
    const answer = "Pin a version and read the changelog when you upgrade.";
    expect(plainAnswer(answer)).toBe(answer);
  });

  it("keeps the prose inside a rich-text tag pair", () => {
    expect(
      plainAnswer("Pin a version and read the <releases>changelog</releases> when you upgrade."),
    ).toBe("Pin a version and read the changelog when you upgrade.");
  });

  it("drops a tag that carries attributes", () => {
    expect(
      plainAnswer('Read the <a href="https://example.test" onmouseover="x()">changelog</a>.'),
    ).toBe("Read the changelog.");
  });

  it("drops a tag whose attributes are unquoted", () => {
    expect(plainAnswer("<img src=x onerror=doSomething()>The rest of the answer.")).toBe(
      "The rest of the answer.",
    );
  });

  it("does not let a nested construction reassemble a tag", () => {
    expect(plainAnswer("<<b>script>doSomething()<</b>/script>")).toBe("doSomething()");
  });

  it("does not let a tag split across an inner tag survive", () => {
    expect(plainAnswer("<scr<b></b>ipt>doSomething()")).toBe("ipt>doSomething()");
  });

  it("does not let a closing tag reassemble around an inner tag", () => {
    expect(plainAnswer("</<b>script>")).toBe("");
  });

  it("drops an unclosed tag through the end of the answer", () => {
    expect(plainAnswer("An answer that ends in an unclosed <script tag")).toBe(
      "An answer that ends in an unclosed ",
    );
  });

  it("keeps angle brackets that do not open a tag", () => {
    expect(plainAnswer("A malformed </ b> closing bracket.")).toBe(
      "A malformed </ b> closing bracket.",
    );
    expect(plainAnswer("Keys under < 10 and over > 5 are counted separately.")).toBe(
      "Keys under < 10 and over > 5 are counted separately.",
    );
  });

  it("never leaves a sequence that could open an element", () => {
    for (const input of ALL_INPUTS) {
      expect(plainAnswer(input)).not.toMatch(/<\/?[a-zA-Z]/);
    }
  });

  it("is idempotent, so a second pass changes nothing", () => {
    for (const input of ALL_INPUTS) {
      const once = plainAnswer(input);
      expect(plainAnswer(once)).toBe(once);
    }
  });
});
