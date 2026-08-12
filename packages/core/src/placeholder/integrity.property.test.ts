import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { checkPlaceholders } from "./integrity.js";

/**
 * Property-based coverage for the placeholder integrity boundary.
 *
 * `checkPlaceholders` compares the placeholders of a source string against those recovered from
 * provider output, which this project treats as untrusted. The example tests next to this file pin
 * the cases the implementation was written for; these properties assert the algebraic invariants
 * that must hold for every input.
 *
 * Two generator choices matter, and both were measured rather than assumed:
 *
 * 1. The alphabet is small and deliberately includes awkward tokens (an empty string, an unclosed
 *    brace, an astral-plane emoji). Random unique strings would practically never repeat or
 *    collide, leaving the duplicate and multiset paths unexercised.
 * 2. Two generators are used, and which one a property gets is load-bearing. `sourceWithNeighbour`
 *    derives the translated list from the source by one controlled edit, because two independent
 *    lists are almost never equal as multisets and so would rarely reach the boundary where
 *    matching and reordering are decided. Properties about the *content* of the report keep
 *    independent lists instead, since a one-edit neighbour differs by at most one token and a
 *    one-element report cannot expose an ordering fault.
 *
 * Both choices were measured against seeded faults rather than assumed. Dropping the sort in
 * `multisetExcess` is caught only by the independent-list properties; ignoring falsy tokens in
 * `counts` is caught only by the near-neighbour ones. Each generator covers what the other misses,
 * so neither set should be collapsed into the other.
 */
const token = fc.constantFrom("{a}", "{b}", "{count}", "%s", "<0>", "", "{{", "\u{1f600}");
const tokenList = fc.array(token, { maxLength: 8 });

/** A source list paired with a near neighbour: itself, a permutation, or an off-by-one edit. */
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

/** True when the two lists hold the same tokens with the same multiplicities, ignoring order. */
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

  // Independent lists, not near neighbours: a single-edit neighbour can differ by at most one
  // token, and a one-element report is sorted no matter what the implementation does. Only widely
  // differing lists produce a report long enough for its ordering to carry information.
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
