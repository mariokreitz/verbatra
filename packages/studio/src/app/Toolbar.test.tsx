// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { FilterBar, Toolbar } from "./Toolbar.js";
import { render } from "./test-support.js";

describe("Toolbar", () => {
  it("renders the controls it was handed", () => {
    const view = render(
      <Toolbar>
        <button type="button">Refresh</button>
      </Toolbar>,
    );

    expect(view.get("button").textContent).toBe("Refresh");
  });

  it("renders no end group when the caller passes none, so nothing empty takes up space", () => {
    const view = render(
      <Toolbar>
        <button type="button">Refresh</button>
      </Toolbar>,
    );

    expect(view.all("div")).toHaveLength(1);
  });

  it("pushes the end slot to the inline-end edge in its own group", () => {
    const view = render(
      <Toolbar end={<button type="button">Export</button>}>
        <button type="button">Refresh</button>
      </Toolbar>,
    );
    const groups = view.all("div");

    expect(groups).toHaveLength(2);
    expect(groups[1]?.className).toContain("ms-auto");
    expect(groups[1]?.textContent).toBe("Export");
  });

  it("wraps onto a second line rather than overflowing on a narrow viewport", () => {
    const view = render(<Toolbar>controls</Toolbar>);

    expect(view.get("div").className).toContain("flex-wrap");
  });

  it("merges a caller className onto the row", () => {
    const view = render(<Toolbar className="mb-2">controls</Toolbar>);

    expect(view.get("div").className).toContain("mb-2");
  });
});

describe("FilterBar", () => {
  it("groups its controls in a fieldset, so they are announced as one named group", () => {
    const view = render(
      <FilterBar>
        <select aria-label="Locale">
          <option value="de">de</option>
        </select>
      </FilterBar>,
    );

    expect(view.get("fieldset").tagName).toBe("FIELDSET");
    expect(view.get("select")).not.toBeNull();
  });

  it("names the group Filters by default", () => {
    const view = render(<FilterBar>controls</FilterBar>);

    expect(view.get("legend").textContent).toBe("Filters");
  });

  it("takes a more specific group name when the caller gives one", () => {
    const view = render(<FilterBar label="Review filters">controls</FilterBar>);

    expect(view.get("legend").textContent).toBe("Review filters");
  });

  it("hides the legend visually, since the group name is for assistive technology only", () => {
    const view = render(<FilterBar>controls</FilterBar>);

    expect(view.get("legend").className).toContain("sr-only");
  });

  it("drops the browser's default fieldset border and padding", () => {
    const view = render(<FilterBar>controls</FilterBar>);
    const className = view.get("fieldset").className;

    expect(className).toContain("border-0");
    expect(className).toContain("p-0");
  });

  it("merges a caller className onto the fieldset", () => {
    const view = render(<FilterBar className="mb-2">controls</FilterBar>);

    expect(view.get("fieldset").className).toContain("mb-2");
  });
});
