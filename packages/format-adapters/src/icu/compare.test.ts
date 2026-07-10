import { describe, expect, it } from "vitest";
import { compareIcuPlaceholders } from "./compare.js";

describe("compareIcuPlaceholders: the BTS-104 bug fix", () => {
  it("flags a placeholder invented in a single target branch when the category exists on both sides", () => {
    const source = "{count, plural, one {# item} other {# items}}";
    const target = "{count, plural, one {# item} other {# items by {author}}}";

    const result = compareIcuPlaceholders(source, target);

    expect(result.matches).toBe(false);
    expect(result.extra).toEqual(["{author}"]);
    expect(result.missing).toEqual([]);
  });

  it("flags a placeholder invented in a single branch of a richer-cardinality target (QA 4-branch pl repro)", () => {
    // English source has only one/other; Polish needs one/few/many/other. The fabrication lives only in
    // "few", a category the source does not have, so it must be caught via the source-union fallback.
    const source = "{count, plural, one {{name} has # apple} other {{name} has # apples}}";
    const target =
      "{count, plural, one {{name} ma # jablko} few {{name} ma {ghost} # jablka} many {{name} ma # jablek} other {{name} ma # jablka}}";

    const result = compareIcuPlaceholders(source, target);

    expect(result.matches).toBe(false);
    expect(result.extra).toEqual(["{ghost}"]);
    expect(result.missing).toEqual([]);
  });

  it("still reports a match for a QA 4-branch pl translation with no fabrication", () => {
    const source = "{count, plural, one {{name} has # apple} other {{name} has # apples}}";
    const target =
      "{count, plural, one {{name} ma # jablko} few {{name} ma # jablka} many {{name} ma # jablek} other {{name} ma # jablka}}";

    const result = compareIcuPlaceholders(source, target);

    expect(result.matches).toBe(true);
    expect(result.extra).toEqual([]);
    expect(result.missing).toEqual([]);
  });
});

describe("compareIcuPlaceholders: the BTS-81 guarantee preserved", () => {
  it("still flags a placeholder dropped from one target branch as missing", () => {
    const source = "{count, plural, one {# by {author}} other {# by {author}}}";
    const target = "{count, plural, one {# by {author}} other {#}}";

    const result = compareIcuPlaceholders(source, target);

    expect(result.matches).toBe(false);
    expect(result.missing).toEqual(["{author}"]);
    expect(result.extra).toEqual([]);
  });

  it("accepts a placeholder present in only one SOURCE branch when the target correctly mirrors it", () => {
    const source = "{count, plural, one {One msg from {sender}} other {# messages}}";
    const target = "{count, plural, one {Eine Nachricht von {sender}} other {# Nachrichten}}";

    const result = compareIcuPlaceholders(source, target);

    expect(result.matches).toBe(true);
  });

  it("accepts a translator reusing a source-only-partial placeholder in a target-only richer category", () => {
    // {sender} appears only in the source's "one" branch. Polish's extra "few"/"many" categories reusing
    // it must not be rejected: the source union includes every source branch, "one" included.
    const source = "{count, plural, one {One msg from {sender}} other {# messages}}";
    const target =
      "{count, plural, one {Jedna wiadomosc od {sender}} few {# wiadomosci od {sender}} many {# wiadomosci} other {# wiadomosci}}";

    const result = compareIcuPlaceholders(source, target);

    expect(result.matches).toBe(true);
  });
});

describe("compareIcuPlaceholders: parse-failure fallback", () => {
  it("falls back to the flat comparison when the source fails to parse", () => {
    const source = "{count, plural, one {x"; // unbalanced, invalid ICU
    const target = "hi {name}";

    const result = compareIcuPlaceholders(source, target);

    // Flat fallback: icuPlaceholders(source) is [] (invalid), so target's {name} is reported as extra.
    expect(result.matches).toBe(false);
    expect(result.extra).toEqual(["{name}"]);
  });

  it("falls back to the flat comparison when the target fails to parse", () => {
    const source = "hi {name}";
    const target = "{count, plural, one {x"; // unbalanced, invalid ICU

    const result = compareIcuPlaceholders(source, target);

    expect(result.matches).toBe(false);
    expect(result.missing).toEqual(["{name}"]);
  });

  it("falls back to a match when both sides are equally invalid", () => {
    const source = "{count, plural, one {x";
    const target = "{n, plural, one {y";

    const result = compareIcuPlaceholders(source, target);

    expect(result.matches).toBe(true);
  });
});

describe("compareIcuPlaceholders: non-plural structure", () => {
  it("matches a plain value with no ICU structure at all", () => {
    expect(compareIcuPlaceholders("just text", "nur Text").matches).toBe(true);
  });

  it("flags a top-level renamed argument as a flat mismatch, not a silent pass", () => {
    const result = compareIcuPlaceholders("hi {name}", "hallo {nom}");
    expect(result.matches).toBe(false);
    expect(result.missing).toEqual(["{name}"]);
    expect(result.extra).toEqual(["{nom}"]);
  });

  it("does not compare branch contents under a renamed plural argument (accepted non-goal)", () => {
    // The rename itself ({count} vs {n}) is caught at the flat layer; the invented {ghost} inside the
    // renamed node's branches is not further inspected, an accepted, pre-existing limitation.
    const source = "{count, plural, one {# item} other {# items}}";
    const target = "{n, plural, one {# item} other {# items by {ghost}}}";

    const result = compareIcuPlaceholders(source, target);

    expect(result.missing).toEqual(["{count}"]);
    expect(result.extra).toEqual(["{n}"]);
  });

  it("recurses into a matched tag pair and catches a placeholder invented inside it", () => {
    const source = "click <link>here</link>";
    const target = "klick <link>hier {ghost}</link>";

    const result = compareIcuPlaceholders(source, target);

    expect(result.matches).toBe(false);
    expect(result.extra).toEqual(["{ghost}"]);
  });

  it("accepts a same-multiset reorder at the top level", () => {
    const result = compareIcuPlaceholders("{a} and {b}", "{b} und {a}");
    expect(result.matches).toBe(true);
  });
});

describe("compareIcuPlaceholders: deep source-union recursion for a target-only category", () => {
  it("descends into a tag inside a source branch when building the richer-category union", () => {
    // {name} lives only inside a <b> tag; the "one"/"other" branches match structurally on both
    // sides (direct comparison), so the "few"/"many" target-only categories are the only ones that
    // exercise the union path, and it must recognize {name} through the tag via deep recursion.
    const source = "{count, plural, one {<b>{name}</b> item} other {<b>{name}</b> items}}";
    const target =
      "{count, plural, one {<b>{name}</b> item} few {{name}} many {y} other {<b>{name}</b> items}}";

    const result = compareIcuPlaceholders(source, target);

    expect(result.matches).toBe(true);
  });

  it("still flags a target-only-category placeholder absent from a tag-nested source branch", () => {
    const source = "{count, plural, one {<b>{name}</b> item} other {<b>{name}</b> items}}";
    const target =
      "{count, plural, one {<b>{name}</b> item} few {{ghost}} many {y} other {<b>{name}</b> items}}";

    const result = compareIcuPlaceholders(source, target);

    expect(result.matches).toBe(false);
    expect(result.extra).toEqual(["{ghost}"]);
  });

  it("descends into a nested select inside a source branch when building the richer-category union", () => {
    // {name} lives only inside a nested select in the source's "other" branch; "one"/"other" match
    // structurally on both sides, so "few"/"many" are the only categories exercising the union path.
    const source =
      "{count, plural, one {solo} other {{g, select, male {He is {name}} female {She is {name}} other {They are {name}}}}}";
    const target =
      "{count, plural, one {solo} few {{name}} many {y} other {{g, select, male {He is {name}} female {She is {name}} other {They are {name}}}}}";

    const result = compareIcuPlaceholders(source, target);

    expect(result.matches).toBe(true);
  });
});

describe("compareIcuPlaceholders: source-only categories are skipped", () => {
  it("does not require a target to cover a source category the target's cardinality lacks", () => {
    // Arabic source has zero/one/two/few/many/other; the German target has only one/other. The
    // source-only categories (zero/two/few/many) impose nothing on the target.
    const source =
      "{count, plural, zero {none} one {{name} 1} two {{name} 2} few {{name} 3} many {{name} 4} other {{name} 5}}";
    const target = "{count, plural, one {{name} eins} other {{name} andere}}";

    const result = compareIcuPlaceholders(source, target);

    expect(result.matches).toBe(true);
  });
});

describe("compareIcuPlaceholders: an unmatched tag is not recursed into", () => {
  it("does not compare a renamed tag's children (the rename itself is caught at the flat layer)", () => {
    const source = "click <link>here {a}</link>";
    const target = "klick <other>hier {b}</other>";

    const result = compareIcuPlaceholders(source, target);

    // The tag rename is caught at the flat layer (<link> missing, <other> extra); the {a}/{b} pair
    // inside the unmatched tags is never inspected, an accepted, pre-existing limitation (Decision 2).
    expect(result.missing).toEqual(["<link>"]);
    expect(result.extra).toEqual(["<other>"]);
  });
});

describe("compareIcuPlaceholders: nested select inside plural", () => {
  it("catches an invented placeholder inside a select nested within a plural branch", () => {
    const source =
      "{count, plural, one {{g, select, male {He has # item} female {She has # item} other {They have # item}}} other {{g, select, male {He has # items} female {She has # items} other {They have # items}}}}";
    const target =
      "{count, plural, one {{g, select, male {Er hat # Artikel} female {Sie hat # Artikel} other {Sie haben # Artikel}}} other {{g, select, male {Er hat # Artikel {ghost}} female {Sie hat # Artikel} other {Sie haben # Artikel}}}}";

    const result = compareIcuPlaceholders(source, target);

    expect(result.matches).toBe(false);
    expect(result.extra).toEqual(["{ghost}"]);
  });
});
