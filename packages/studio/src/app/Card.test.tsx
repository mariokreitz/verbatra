// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Card } from "./Card.js";
import { render } from "./test-support.js";

describe("Card", () => {
  it("renders a plain div by default, so a card is not a landmark unless asked", () => {
    const view = render(<Card>Body</Card>);

    expect(view.get("div").tagName).toBe("DIV");
    expect(view.query("section")).toBeNull();
  });

  it("renders a section when the card is a landmark with its own heading", () => {
    const view = render(
      <Card as="section">
        <h2>Locales</h2>
      </Card>,
    );

    expect(view.get("section").tagName).toBe("SECTION");
  });

  it("applies the medium padding by default", () => {
    const view = render(<Card>Body</Card>);

    expect(view.get("div").className).toContain("p-6");
  });

  it("applies the small padding on request", () => {
    const view = render(<Card padding="sm">Body</Card>);
    const className = view.get("div").className;

    expect(className).toContain("p-4");
    expect(className).not.toContain("p-6");
  });

  it("adds no padding at all for flush content such as an edge-to-edge table", () => {
    const view = render(<Card padding="none">Body</Card>);
    const className = view.get("div").className;

    expect(className).not.toContain("p-4");
    expect(className).not.toContain("p-6");
  });

  it("keeps the bordered surface treatment in every padding mode", () => {
    const view = render(<Card padding="none">Body</Card>);
    const className = view.get("div").className;

    expect(className).toContain("border-border");
    expect(className).toContain("bg-card");
  });

  it("merges a caller className onto the surface classes", () => {
    const view = render(<Card className="mb-6">Body</Card>);

    expect(view.get("div").className).toContain("mb-6");
  });

  it("forwards native div attributes, so a caller can make the card a live region", () => {
    const view = render(
      <Card role="status" aria-live="polite">
        Saved
      </Card>,
    );
    const card = view.get("div");

    expect(card.getAttribute("role")).toBe("status");
    expect(card.getAttribute("aria-live")).toBe("polite");
  });

  it("renders the children it was handed", () => {
    const view = render(
      <Card>
        <p>Two locales behind</p>
      </Card>,
    );

    expect(view.get("p").textContent).toBe("Two locales behind");
  });
});
