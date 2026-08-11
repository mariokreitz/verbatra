// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import type { TabItem } from "./Tabs.js";
import { Tabs } from "./Tabs.js";
import type { RenderResult } from "./test-support.js";
import { click, render } from "./test-support.js";

type PanelId = "overview" | "review" | "history";

const ITEMS: readonly TabItem<PanelId>[] = [
  { id: "overview", label: "Overview" },
  { id: "review", label: "Review" },
  { id: "history", label: "History" },
];

function renderTabs(active: PanelId, onChange: (id: PanelId) => void = () => {}): RenderResult {
  return render(<Tabs items={ITEMS} active={active} onChange={onChange} label="Panels" />);
}

describe("Tabs", () => {
  it("renders one segment per item, in the given order", () => {
    const view = renderTabs("overview");

    expect(view.all("button").map((button) => button.textContent)).toEqual([
      "Overview",
      "Review",
      "History",
    ]);
  });

  it("names the strip for assistive technology", () => {
    const view = renderTabs("overview");

    expect(view.get("fieldset").getAttribute("aria-label")).toBe("Panels");
  });

  it("marks only the active segment as pressed", () => {
    const view = renderTabs("review");

    expect(view.all("button").map((button) => button.getAttribute("aria-pressed"))).toEqual([
      "false",
      "true",
      "false",
    ]);
  });

  it("lifts the active segment onto a card surface, so the state is not carried by ARIA alone", () => {
    const view = renderTabs("review");
    const buttons = view.all("button");

    expect(buttons[1]?.className).toContain("bg-card");
    expect(buttons[0]?.className).not.toContain("bg-card");
  });

  it("reports the id of the segment that was pressed", () => {
    const onChange = vi.fn();
    const view = renderTabs("overview", onChange);

    click(view.getByText("button", "History"));

    expect(onChange).toHaveBeenCalledWith("history");
  });

  it("still reports a press on the already active segment, since it is a controlled strip", () => {
    const onChange = vi.fn();
    const view = renderTabs("overview", onChange);

    click(view.getByText("button", "Overview"));

    expect(onChange).toHaveBeenCalledWith("overview");
  });

  it("does not change the active segment on its own: the caller owns the state", () => {
    const view = renderTabs("overview");

    click(view.getByText("button", "History"));

    expect(view.getByText("button", "Overview").getAttribute("aria-pressed")).toBe("true");
  });

  it("uses non-submitting buttons, so a strip inside a form never posts it", () => {
    const view = renderTabs("overview");

    for (const button of view.all("button")) {
      expect(button.getAttribute("type")).toBe("button");
    }
  });

  it("renders an empty strip without failing when there are no items", () => {
    const view = render(<Tabs items={[]} active="overview" onChange={() => {}} label="Panels" />);

    expect(view.all("button")).toHaveLength(0);
  });
});
