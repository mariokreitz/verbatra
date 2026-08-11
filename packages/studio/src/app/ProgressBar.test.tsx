// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { ProgressBar } from "./ProgressBar.js";
import { render } from "./test-support.js";

describe("ProgressBar", () => {
  it("is decorative by default, so a bar beside its own printed number is not announced twice", () => {
    const view = render(<ProgressBar percent={40} />);
    const track = view.get("span");

    expect(track.getAttribute("aria-hidden")).toBe("true");
    expect(track.getAttribute("role")).toBeNull();
  });

  it("becomes a progressbar with the value wired up when it carries the value alone", () => {
    const view = render(<ProgressBar percent={40} ariaLabel="Budget used" />);
    const track = view.get("span");

    expect(track.getAttribute("role")).toBe("progressbar");
    expect(track.getAttribute("aria-label")).toBe("Budget used");
    expect(track.getAttribute("aria-hidden")).toBeNull();
  });

  it("reports the value against a fixed 0-100 range", () => {
    const view = render(<ProgressBar percent={40} ariaLabel="Budget used" />);
    const track = view.get("span");

    expect(track.getAttribute("aria-valuemin")).toBe("0");
    expect(track.getAttribute("aria-valuemax")).toBe("100");
    expect(track.getAttribute("aria-valuenow")).toBe("40");
  });

  it("fills the track to the given percentage", () => {
    const view = render(<ProgressBar percent={62.5} />);

    expect(view.get("span > span").style.width).toBe("62.5%");
  });

  it("clamps a negative percentage to an empty bar rather than an inverted one", () => {
    const view = render(<ProgressBar percent={-20} ariaLabel="Budget used" />);

    expect(view.get("span").getAttribute("aria-valuenow")).toBe("0");
    expect(view.get("span > span").style.width).toBe("0%");
  });

  it("clamps a percentage above 100 to a full bar, which an overspent budget produces", () => {
    const view = render(<ProgressBar percent={150} ariaLabel="Budget used" />);

    expect(view.get("span").getAttribute("aria-valuenow")).toBe("100");
    expect(view.get("span > span").style.width).toBe("100%");
  });

  it("fills in the primary tone by default", () => {
    const view = render(<ProgressBar percent={30} />);

    expect(view.get("span > span").className).toContain("bg-primary");
  });

  it("fills in the danger tone for an exhausted budget", () => {
    const view = render(<ProgressBar percent={100} tone="danger" />);
    const className = view.get("span > span").className;

    expect(className).toContain("bg-danger");
    expect(className).not.toContain("bg-primary");
  });

  it("merges a caller className onto the track, so a caller can size it", () => {
    const view = render(<ProgressBar percent={10} className="mt-2" />);

    expect(view.get("span").className).toContain("mt-2");
  });

  it("clips the fill to the track, so a rounded bar never overflows its corners", () => {
    const view = render(<ProgressBar percent={10} />);

    expect(view.get("span").className).toContain("overflow-hidden");
  });
});
