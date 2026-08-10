// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Toast } from "./Toast.js";
import { render } from "./test-support.js";

describe("Toast", () => {
  it("is a live region, so the message is announced without stealing focus", () => {
    const view = render(<Toast>Saved</Toast>);

    expect(view.get("div").getAttribute("role")).toBe("status");
  });

  it("renders the caller's content, since the shell never derives its own copy", () => {
    const view = render(
      <Toast>
        <p>Three keys updated</p>
      </Toast>,
    );

    expect(view.get("p").textContent).toBe("Three keys updated");
  });

  it("pins itself to the viewport's bottom-right corner above the page content", () => {
    const view = render(<Toast>Saved</Toast>);
    const className = view.get("div").className;

    expect(className).toContain("fixed");
    expect(className).toContain("bottom-6");
    expect(className).toContain("right-6");
  });

  it("uses the card's small padding, the compact treatment a toast needs", () => {
    const view = render(<Toast>Saved</Toast>);

    expect(view.get("div").className).toContain("p-4");
  });
});
