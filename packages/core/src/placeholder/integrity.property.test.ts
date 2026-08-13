import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { checkPlaceholders } from "./integrity.js";

const token = fc.constantFrom("{a}", "{b}", "{count}", "%s", "<0>", "", "{{", "\u{1f600}");
const tokenList = fc.array(token, { maxLength: 8 });

const sourceWithNeighbour = tokenList.chain((source) => {
  const neighbours = [
    fc.constant(source),
    fc.shuffledSubarray(source, { minLength: source.length, maxLength: source.length }),
    token.map((extra) => [...source, extra]),
  ];

  if (source.length > 0) {
    const index = fc.nat({ max: source.length - 1 });
    neighbours.push(index.map((at) => source.filter((_, position) => position !== at)));
    neighbours.push(
      index.map((at) =>
        source.flatMap((item, position) => (position === at ? [item, item] : [item])),
      ),
    );
  }

  return fc.tuple(fc.constant(source), fc.oneof(...neighbours));
});

function equalAsMultisets(a: readonly string[], b: readonly string[]): boolean {
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return (
    sortedA.length === sortedB.length && sortedA.every((item, index) => item === sortedB[index])
  );
}

describe("checkPlaceholders properties", () => {
  it("never throws, for related or wholly unrelated lists", () => {
    fc.assert(
      fc.property(tokenList, tokenList, (source, translated) => {
        expect(() => checkPlaceholders(source, translated)).not.toThrow();
      }),
    );
  });

  it("reports a match exactly when the lists are equal as multisets", () => {
    fc.assert(
      fc.property(sourceWithNeighbour, ([source, translated]) => {
        expect(checkPlaceholders(source, translated).matches).toBe(
          equalAsMultisets(source, translated),
        );
      }),
    );
  });

  it("treats any list as matching itself, and never calls that a reorder", () => {
    fc.assert(
      fc.property(tokenList, (source) => {
        expect(checkPlaceholders(source, source)).toEqual({
          matches: true,
          missing: [],
          extra: [],
          reordered: false,
        });
      }),
    );
  });

  it("accepts every permutation of the source as a match", () => {
    const listWithPermutation = tokenList.chain((source) =>
      fc.tuple(
        fc.constant(source),
        fc.shuffledSubarray(source, { minLength: source.length, maxLength: source.length }),
      ),
    );

    fc.assert(
      fc.property(listWithPermutation, ([source, permuted]) => {
        expect(checkPlaceholders(source, permuted).matches).toBe(true);
      }),
    );
  });

  it("swaps missing and extra when the arguments are swapped", () => {
    fc.assert(
      fc.property(tokenList, tokenList, (source, translated) => {
        const forward = checkPlaceholders(source, translated);
        const reverse = checkPlaceholders(translated, source);

        expect(forward.missing).toEqual(reverse.extra);
        expect(forward.extra).toEqual(reverse.missing);
      }),
    );
  });

  it("flags a reorder only when the multisets match but the order differs", () => {
    fc.assert(
      fc.property(sourceWithNeighbour, ([source, translated]) => {
        const result = checkPlaceholders(source, translated);
        const orderDiffers =
          source.length !== translated.length ||
          source.some((item, index) => item !== translated[index]);

        expect(result.reordered).toBe(result.matches && orderDiffers);
      }),
    );
  });

  it("returns missing and extra sorted, so the report is stable across input orderings", () => {
    fc.assert(
      fc.property(tokenList, tokenList, (source, translated) => {
        const { missing, extra } = checkPlaceholders(source, translated);
        expect(missing).toEqual([...missing].sort());
        expect(extra).toEqual([...extra].sort());
      }),
    );
  });
});
